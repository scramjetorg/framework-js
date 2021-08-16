import { cpus } from "os";
import { trace } from "../utils"

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)
export type TransformErrorHandler<S, T> = (err: ErrorWithReason|undefined, chunk?: S) => MaybePromise<T|undefined>;
export type IFCAOptions = Partial<{ strict: boolean }>
export type ErrorWithReason = Error & { cause?: Error };
export type TransformArray<S, T> = [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    ...TransformFunction<any, any>[],
    TransformFunction<any, T>
];

const isAsync = (func: any[]) => func.length && (
    func[0] && func[0][Symbol.toStringTag] === 'AsyncFunction' || 
    func[1] && func[1][Symbol.toStringTag] === 'AsyncFunction'
);

export interface IIFCA<S,T,I extends IIFCA<S,any,any>> {
    // TODO: This may need a setter if maxParallel is increased so that chunks are not waiting for drain.
    maxParallel: number;

    // TODO: make these two into one array of `ChunkResolver`s
    // transforms: TransformArray<S, T>;
    // handlers: TransformErrorHandler<S, T>[];

    transformHandlers: TransformHandler<S,T>[];

    /**
     * Write (add chunk)
     * 
     * @param chunk Chunk to be processed
     */
    write(chunk: S): MaybePromise<void>;
    end(): MaybePromise<void|null>;

    read(): MaybePromise<T|null>;
    
    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<T,W>, err?: TransformErrorHandler<T,W>): IIFCA<S,W,this>;
    removeTransform(): I;
}

type TransformHandler<S,T> = [TransformFunction<S,T>, TransformErrorHandler<S,T>?] | [undefined, TransformErrorHandler<S,T>];
type ChunkResolver<S> = [TransformFunction<S|null,void>, TransformErrorHandler<S,void>?];
type MaybePromise<S> = Promise<S> | S;
type NullTerminatedArray<X extends any[]> = X | [...X, null]

export class IFCA<S,T,I extends IFCA<S,any,any>> implements IIFCA<S,T,I> {

    constructor(
        public maxParallel = 2 * cpus().length, 
        initialTransform: TransformFunction<S,T>,
        options: IFCAOptions = {}
    ) {
        this.transformHandlers.push([initialTransform])
        this.strict = !!options.strict;
    }

    transformHandlers: TransformHandler<S,T>[] = [];
    
    // transforms: TransformArray<S, T>;
    // public handlers = [] as TransformErrorHandler<S,T>[];

    private processing: Promise<any>[] = []
    private readable: NullTerminatedArray<T[]> = [];
    private readers: ChunkResolver<T>[] = [];
    private ended: boolean = false;
    private readonly strict: boolean;

    get status() {
        return "R,".repeat(this.readers.length) + this.processing.slice(this.readers.length).map((x,i) => this.readable[this.readers.length + i] ? 'd,' : 'p,')
    }

    write(_chunk: S): MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");

        const pos = this.processing.length;
        trace('IFCA WRITE pos: ', pos, _chunk)
        const drain: MaybePromise<any> = pos < this.maxParallel 
            ? undefined 
            : this.processing[pos - this.maxParallel].finally()
        ;
        const chunkBeforeThisOne = this.processing[pos - 1];
        const currentChunkResult = this.strict ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);
        
        this.processing.push(
            this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult, _chunk)
        );
        
        trace('DRAIN WRITE:');
        trace(drain);
        return drain;
    }

    writev(_chunks: S[]):MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");

        const pos = this.processing.length;
        trace('IFCA WRITE pos:', pos, _chunks)
        const drain: MaybePromise<any> = pos < this.maxParallel 
            ? undefined 
            : this.processing[pos - this.maxParallel]
        ;
        const chunkBeforeThisOne = this.processing[pos - 1];
        const currentChunksResult = _chunks.map(chunk => this.strict ? this.makeStrictTransformChain(chunk) : this.makeTransformChain(chunk));
        
        this.processing.push(
            ...this.makeProcessingItems(chunkBeforeThisOne, currentChunksResult, _chunks)
        );
        trace('DRAIN WRITEV:');
        trace(drain);

        return drain;
    }

    // TODO: add chunks
    private makeProcessingItems(chunkBeforeThisOne: Promise<any>, currentChunksResult: MaybePromise<T>[], _chunks: S[]): Promise<any>[] {
        const result:MaybePromise<any>[] = [];
        result.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunksResult[0], _chunks[0]));
        for (let i = 1; i < currentChunksResult.length; i++) {
            result.push(this.makeProcessingItem(currentChunksResult[i - 1] as Promise<T>, currentChunksResult[i], _chunks[i]))
        }

        return result;
    } 

    // TODO: here's a low hanging fruit for implementing non-ordered processing
    private makeProcessingItem(chunkBeforeThisOne: Promise<any>, currentChunkResult: MaybePromise<T>, processingChunk: S): Promise<any> {
        const currentSafeChunkResult = 
            "catch" in currentChunkResult
                ? currentChunkResult.catch(
                    (err: Error) => {
                        if (err) {
                            if (this.readers.length) {
                                const res = this.readers[0];
                                if (res[1]) {
                                    this.readers.shift();
                                    // TODO: this potentially throws?
                                    return res[1](err);
                                }
                            }
                            throw err;
                        }
                        return;
                    }
                )
                : currentChunkResult

        return Promise.all([
            chunkBeforeThisOne?.finally(), 
            currentSafeChunkResult
        ])
            .then(([, result]) => {
                this.processing.shift();
                if (result !== undefined)
                    this.readers.length
                        ? (this.readers.shift() as ChunkResolver<T>)[0](result)
                        : this.readable.push(result);
            })
            .catch(e => {
                if (typeof e === "undefined") return;
                throw e;
            });
    }

    private makeStrictTransformChain(_chunk: S): MaybePromise<T> {
        let funcs = [...this.transformHandlers] as TransformHandler<any, any>[];
        if (!funcs.length) return _chunk as unknown as T;
        
        let value: any = _chunk;

        // Synchronous start
        const syncFunctions = funcs.findIndex(isAsync);
        if (syncFunctions > 0) {
            value = this.makeSynchronousChain(funcs.slice(0, syncFunctions), _chunk)(value);
            funcs = funcs.slice(syncFunctions);
        }

        if (!funcs.length) return value;

        let next = Promise.resolve(value);
        while(funcs.length) {
            const handler = funcs.shift() as TransformHandler<any, any>;
            next = next.then(...handler);

            const syncFunctions = funcs.findIndex(isAsync);
            
            if (syncFunctions > 0) {
                next = next.then(this.makeSynchronousChain(funcs.slice(0, syncFunctions), _chunk));
                funcs = funcs.slice(syncFunctions);
            }
        }
        return next;
    }

    private makeSynchronousChain<X,Y>(funcs: TransformHandler<X, Y>[], processingChunk: X): (a: X) => Y {
        return funcs.reduce.bind(funcs, (acc, func) => {
            try {
                if (!func[0]) return acc;
                return func[0](acc as any);
            } catch(e) {
                if (typeof e === "undefined") return;
                if (func[1]) {
                    return func[1](e, processingChunk);
                }
                throw e;
            }
        }) as (a: X) => Y;
    }
        
    private makeTransformChain(_chunk: S): Promise<T> {
        let ret: Promise<T> = (this.transformHandlers as TransformHandler<any, any>[])
            .reduce(
                // TODO: maybe here we should have the argument to prev
                (prev, [_executor, _handler]) => {
                    if (!_handler) return prev.then(_executor?.bind(this));

                    // TODO: check why chunk is undefined
                    const handler: TransformErrorHandler<any, any> = (err, chunk) => {
                        if (typeof err === "undefined") return Promise.reject(undefined);
                        return _handler.bind(this)(err, chunk);
                    }
                    if (!_executor && handler) return prev.catch(handler);
                    return prev.then(_executor?.bind(this), handler);
                },
                Promise.resolve(_chunk)
            ) as Promise<unknown> as Promise<T>;

        // Promise.resolve(1)
        //     .then(b => b+2)
        //     .then(a => a+1)
        //     .then(fx, fy)
        //     .catch(z)

        return ret;
    }

    end(): MaybePromise<void|null> {
        const last = this.processing[this.processing.length - 1];
        
        if (last) 
            return last.then(() => this.handleEnd());
        this.handleEnd();
    }

    private handleEnd() {
        this.ended = true;
        this.readers.slice(this.processing.length).forEach(([res]) => res(null));
        this.readable.push(null as unknown as T);
        return null;
    }

    read(): MaybePromise<T|null> {
        trace('IFCA-READ()')
        const ret = this.processing.shift();
        if (this.readable[0] === null) {
            // TODO: this makes nulls precede data
            trace('IFCA-READ READABLE-NULL')
            return this.handleEnd();
        }
        else if (this.readable.length > 0) {
            // TODO: this disallows falsy values
            // inlcuding those with .valueOf() === false
            trace('IFCA-READ READABLE-EXISTS');
            return this.readable.shift() as T;
        }
        else if (ret) {
            trace('IFCA-READ PROCESSING-AWAIT');
            return ret.then(() => this.read());
        }
        else if (this.ended) {
            trace('IFCA-READ ENDED');
            return null;
        }

        trace('IFCA-READ RETURN NEW PROMISE');
        // This gives Promise { <pending> }
        // In scribbe.spec.js this never resolves
        return new Promise((...res) => { 
            trace('IFCA-READ INSIDE PROMISE');
            trace('READERS', this.readers);
            return this.readers.push(res)
        });
    }

    last(): PromiseLike<T> { 
        return this.processing[this.processing.length - 1];
    }

    addErrorHandler(handler: TransformErrorHandler<S,T>): this {
        this.transformHandlers.push([, handler]);

        return this;
    }

    addTransform<W>(transform: TransformFunction<T, W>, handler?: TransformErrorHandler<T, W>): IFCA<S, W, this> {
        (this.transformHandlers as any[]).push([transform, handler]);
        return this as IFCA<S,unknown,any> as IFCA<S,W,this>;
    }

    // Remove transform (pop)
    removeTransform(): I {
        this.transformHandlers.shift();
        return this as IFCA<S,unknown,any> as I;
    }

}