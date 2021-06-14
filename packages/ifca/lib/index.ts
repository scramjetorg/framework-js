import { Readable } from "stream";

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export interface IIFCA<T,S> {
    // TODO: This may need a setter if maxParallel is increased so that chunks are not waiting for drain.
    maxParallel: number;
    transforms: TransformFunction<any,any>[];

    /**
     * Write (add chunk)
     * 
     * @param chunk Chunk to be processed
     */
    write(chunk: T): PromiseLike<void>;

    read(items: number): Promise<AsyncIterable<S>>;
    // last(): PromiseLike<S>

    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<S,W>): IIFCA<T,S>;
    // removeTransform<W>(tr: TransformFunction<W,S>): IIFCA<T,W>;
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

    maxParallel: number;
    transforms: TransformFunction<any, any>[] = [];
    private queue: ProcessingItem<S>[] = [];
    private processing: PromiseLike<any>[] = [];
    private readable: S[] = [];
    private readers: ChunkResolver<S>[] = [];

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

    // private addResult(resultToBeReadInOrder: S) {
    //     if (this.readers.length > 0) {
    //         (this.readers.shift() as ChunkResolver<S>)(resultToBeReadInOrder);
    //     } else {
    //         this.readable.push(resultToBeReadInOrder);
    //     }

    //     this.processing.shift();
    // }

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