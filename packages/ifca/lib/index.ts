import { Readable } from "stream";
import { cpus } from "os";

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export type TransformArray<S, T> = [] | [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    ...TransformFunction<any, any>[],
    TransformFunction<any, T>
];

export interface IIFCA<S,T,I extends undefined|IIFCA<S,any,any>> {
    // TODO: This may need a setter if maxParallel is increased so that chunks are not waiting for drain.
    maxParallel: number;
    transforms: TransformArray<S, T>;

    status?: string;

    /**
     * Write (add chunk)
     * 
     * @param chunk Chunk to be processed
     */
    write(chunk: S): MaybePromise<void>;
    end(): MaybePromise<void>;

    read(): MaybePromise<T|null>;
    
    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<T,W>): IIFCA<S,W,this>;
    removeTransform(): I;
}

type ChunkResolver<S> = (chunk: S) => void;
type MaybePromise<S> = Promise<S> | S;

class ProcessingItem<S> {
    processing: Promise<S>;
    done: boolean = false;
    private read?: ChunkResolver<S>;
    private error?: (err: Error) => void;

    constructor(proc: Promise<S>) {
        this.processing = proc;
        proc.then(
            (chunk) => {
                this.done = true;
                this.read && this.read(chunk);
            },
            (error) => {
                this.done = true;
                this.error && this.error(error)
            }
        )
    }

    /** @readonly */
    get value(): Promise<S> {
        return this.done
            ? this.processing
            : new Promise((res, rej) => {
                this.read = res
                this.error = rej;
            });
    }
};

export class IFCA<T,S> {
    constructor(maxParallel: number) {
        this.maxParallel = maxParallel;
    }

    transforms: TransformFunction<any, any>[] = [];

    private _maxParallel: number = 2 * cpus().length;
    private queue: ProcessingItem<S>[] = [];
    private processing: PromiseLike<any>[] = [];
    private readable: S[] = [];
    private readers: ChunkResolver<S>[] = [];

    set maxParallel(value) {
        this._maxParallel = value;
    }

    get maxParallel() {
        return this._maxParallel;
    }

    async write(_chunk: T) {
        const drain: MaybePromise<any> | undefined = 
            this.processing.length < this.maxParallel 
                ? undefined 
                : this.queue[this.processing.length - this.maxParallel].done
            ;
        const chunkBeforeThisOne = this.processing[this.processing.length - 1];
        
        const currentChunkResult: Promise<S> = this.transforms
            .reduce(
                (prev, transform) => prev.then(transform.bind(this)), 
                Promise.resolve(_chunk)
            ) as unknown as Promise<S>;

        this.queue.push(
            new ProcessingItem(Promise
                .all([chunkBeforeThisOne, currentChunkResult])
                .then(([, result]) => result)
        ));

        return drain;
    }

    read(items: number): AsyncIterable<S> {
        const results = this.readable.splice(0, items);
        if (results.length === items) return Readable.from(results);
        
        const resultPromises: PromiseLike<S>[] = 
            (new Array(results.length - items))
                .fill(1)
                .map(() => new Promise((res: ChunkResolver<S>) => this.readers.push(res)))
        ;

        return (async function*() {
            yield* results;

            while (true) {
                const out = await resultPromises.shift();
                if (!out) return;
                yield out;
            }
        })();
    }

    last(): PromiseLike<S> { 
            return this.processing[this.processing.length - 1];        
    
    }

    addTransform<W>(_tr: TransformFunction<S, W>): IFCA<T, S> {
        this.transforms.push(_tr);
        return this;
        
    }
    // Remove transform (pop)
    removeTransform<W>(_tr: TransformFunction<W, S>): IFCA<T, S> {
        throw new Error("Method not implemented.");
    }

}