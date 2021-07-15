import { cpus } from "os";

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export type TransformArray<S, T> = [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    ...TransformFunction<any, any>[],
    TransformFunction<any, T>
];

export interface IIFCA<S,T,I extends IIFCA<S,any,any>> {
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

type ChunkResolver<S> = [(chunk: S|null) => void, (err?: Error|null) => void];
type MaybePromise<S> = Promise<S> | S;
type NullTerminatedArray<X extends any[]> = X | [...X, null]

export class IFCA<S,T,I extends IFCA<S,any,any>> implements IIFCA<S,T,I> {

    constructor(
        public maxParallel: number = 2 * cpus().length, 
        initialTransform: TransformFunction<S,T>
    ) {
        this.transforms = [initialTransform];
    }

    transforms: TransformArray<S, T>;

    private processing: Promise<any>[] = []
    private readable: NullTerminatedArray<T[]> = [];
    private readers: ChunkResolver<T>[] = [];
    private ended: boolean = false;

    get status() {
        return "R,".repeat(this.readers.length) + this.processing.slice(this.readers.length).map((x,i) => this.readable[this.readers.length + i] ? 'd,' : 'p,')
    }

    write(_chunk: S): MaybePromise<void> {
        console.log('IFCA WRITE _chunk:' + JSON.stringify(_chunk))
        if (this.ended) throw new Error("Write after end");

        const pos = this.processing.length;
        console.log('IFCA WRITE pos: ' + pos)
        const drain: MaybePromise<any> = pos < this.maxParallel 
            ? undefined 
            : this.processing[pos - this.maxParallel]
        ;
        const chunkBeforeThisOne = this.processing[pos - 1];
        const currentChunkResult = this.makeTransformChain(_chunk);
        
        this.processing.push(
            this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult)
        );
        console.log('DRAIN:');
        console.log(drain);

        return drain;
    }

    writev(_chunks: S[]):MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");

        const pos = this.processing.length;
        console.log('IFCA WRITE pos: ' + pos)
        const drain: MaybePromise<any> = pos < this.maxParallel 
            ? undefined 
            : this.processing[pos - this.maxParallel]
        ;
        const chunkBeforeThisOne = this.processing[pos - 1];
        const currentChunksResult = _chunks.map(chunk => this.makeTransformChain(chunk));
        
        this.processing.push(
            ...this.makeProcessingItems(chunkBeforeThisOne, currentChunksResult)
        );
        console.log('DRAIN:');
        console.log(drain);

        return drain;
    }

    private makeProcessingItems(chunkBeforeThisOne: Promise<any>, currentChunksResult: Promise<T>[]): Promise<any>[] {
        const result = [];
        result.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunksResult[0]));
        for (let i = 1; i < currentChunksResult.length; i++) {
            result.push(currentChunksResult[i - 1], currentChunksResult[i])
        }

        return result;
    } 
    private makeProcessingItem(chunkBeforeThisOne: Promise<any>, currentChunkResult: Promise<T>): Promise<any> {
        return Promise.all([
            chunkBeforeThisOne, 
            currentChunkResult
                .catch(
                    (err: Error) => this.readers.length
                        ? (this.readers.shift() as ChunkResolver<T>)[1](err)
                        : undefined
                )
        ])
            .then(([, result]) => {
                // console.log("result", result, this.processing.length, this.readers.length);

                this.processing.shift();
                if (result !== undefined)
                    this.readers.length
                        ? (this.readers.shift() as ChunkResolver<T>)[0](result)
                        : this.readable.push(result);
            });
    }

    private makeTransformChain(_chunk: S): Promise<T> {
        return (this.transforms as TransformFunction<any, any>[])
            .reduce(
                (prev, transform) => prev.then(transform.bind(this)),
                Promise.resolve(_chunk)
            ) as Promise<unknown> as Promise<T>;
    }

    end(): MaybePromise<void> {
        const last = this.processing[this.processing.length - 1];
        
        if (last) 
            return last.then(() => this.end())
        this.handleEnd();
    }

    private handleEnd() {
        // console.log("HE");
        this.ended = true;
        this.readers.slice(this.processing.length).forEach(([res]) => res(null));
        this.readable.push(null as unknown as T);
        return null;
    }

    read(): MaybePromise<T|null> {
        // console.log("R", this.ended, this.readable[0], this.readable.length, this.processing.length)

        const ret = this.processing.shift();
        if (this.readable[0] === null)
            return this.handleEnd();
        else if (this.readable[0])
            return this.readable.shift() as T;
        else if (ret)
            return ret.then(() => this.read());
        else if (this.ended)
            return null;

        return new Promise((...res) => this.readers.push(res));
    }

    last(): PromiseLike<T> { 
        return this.processing[this.processing.length - 1];
    }

    addTransform<W>(_tr: TransformFunction<T, W>): IFCA<S, W, this> {
        (this.transforms as any[]).push(_tr);
        return this as IFCA<S,unknown,any> as IFCA<S,W,this>;
    }

    // Remove transform (pop)
    removeTransform(): I  {
        this.transforms.shift();
        return this as IFCA<S,unknown,any> as I;
    }

}