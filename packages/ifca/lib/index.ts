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

const noop = () => { };

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
     * https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1
     * All Writable stream implementations must provide a writable._write() and/or writable._writev() method to send data to the underlying resource.
     * 
     * @param {Object|null} _chunk The data to be written
     * @returns {MaybePromise}
     */
    write(chunk: S): MaybePromise<void>;

    /**
     * End
     * 
     * @returns {MaybePromise}
     */
    end(): MaybePromise<void|null>;

    /**
     * Read
     * 
     * @returns {MaybePromise}
     */
    read(): MaybePromise<T|null>;
    
    // TODO: destroy(e: Error): void;

    /**
     * Add transform
     * 
     * @param {TransformFunction} transform Transform function
     * @param {TransformErrorHandler} [handler] Optional transform error handler
     * @returns {IFCA}
     */
    addTransform<W>(tr: TransformFunction<T,W>, err?: TransformErrorHandler<T,W>): IIFCA<S,W,this>;

    /**
     * Remove transform (pop)
     * 
     * @returns {IFCA}
     */
    removeTransform(): I;
}

type TransformHandler<S,T> = [TransformFunction<S,T>, TransformErrorHandler<S,T>?] | [undefined, TransformErrorHandler<S,T>];
type ChunkResolver<S> = [TransformFunction<S|null,void>, TransformErrorHandler<S,void>?];
type MaybePromise<S> = Promise<S> | S;
type NullTerminatedArray<X extends any[]> = X | [...X, null]

export class IFCA<S,T,I extends IFCA<S,any,any>> implements IIFCA<S,T,I> {

    /**
     * Create IFCA.
     * 
     * ```javascript
     * const MAX_PARALLEL = 4;
     * 
     * const fn = (x: {i: number}) => {t.log('Processing', x); return x};
     * 
     * const ifca = new IFCA(MAX_PARALLEL, fn, { strict: false });
     * ```
     * 
     * @param {number} maxParallel Max Parallel defines how many items we can process parallel
     * @param {TransformFunction} initialTransform Initial Transformation 
     * @param {IFCAOptions} [options] Options
     */
    constructor(
        public maxParallel = 2 * cpus().length, 
        initialTransform: TransformFunction<S,T>,
        options: IFCAOptions = {}
    ) {
        this.transformHandlers.push([initialTransform])
        this.strict = !!options.strict;
    }

    /**
     * Transformation Handlers Array
     */
    transformHandlers: TransformHandler<S,T>[] = [];
    
    // transforms: TransformArray<S, T>;
    // public handlers = [] as TransformErrorHandler<S,T>[];

    private processing: Promise<any>[] = []
    // private processing_await?: Promise<any>;
    private readable: NullTerminatedArray<T[]> = [];
    private readers: ChunkResolver<T>[] = [];
    private ended: boolean = false;
    private readonly strict: boolean;

    get status() {
        return "R,".repeat(this.readers.length) + this.processing.slice(this.readers.length).map((x,i) => this.readable[this.readers.length + i] ? 'd,' : 'p,')
    }


    /**
     * Write (add chunk)
     * 
     * Once processing reaches maxParallel then write method returns drain (pending promise). Otherwise undefined is returned
     * 
     * https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1
     * All Writable stream implementations must provide a writable._write() and/or writable._writev() method to send data to the underlying resource.
     * 
     * @param {Object|null} _chunk The data to be written
     * @returns {MaybePromise|undefined}
     */
    write(_chunk: S|null): MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");
        if (_chunk === null) return this.end();

        const pos = this.processing.length;
        trace('IFCA WRITE pos: ', pos, _chunk)
        const drain: MaybePromise<any> = pos < this.maxParallel 
            ? undefined 
            : this.processing[pos - this.maxParallel].finally()
        ;
        const chunkBeforeThisOne = this.processing[pos - 1]; // First one is undefined obviously. Rest are Promise { <pending> } 
        const currentChunkResult = this.strict ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);
        
        /**
         * Make processing item and push to processing array in order to start processing transformations.
         */
        this.processing.push(
            this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult, _chunk)
        );
        
        trace('DRAIN WRITE:', drain);
        return drain;
    }

    /**
     * Write array of chunks
     * 
     * Basically copy of write method that instead of one chunk can process array of chunks.
     * 
     * https://nodejs.org/api/stream.html#stream_writable_writev_chunks_callback
     * All Writable stream implementations must provide a writable._write() and/or writable._writev() method to send data to the underlying resource.
     * 
     * @param {Object[]|null}_chunks The data to be written. The value is an array of <Object> that each represent a discrete chunk of data to write.
     * @returns {MaybePromise} 
     */
    writev(_chunks: (S|null)[]):MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");

        const pos = this.processing.length;
        trace('IFCA WRITEV pos:', pos, _chunks)
        const drain: MaybePromise<void> = pos < this.maxParallel 
            ? undefined 
            : this.processing[pos - this.maxParallel]
        ;
        const chunkBeforeThisOne = this.processing[pos - 1];
        const chunksToBeProcessed = (_chunks.indexOf(null) >= 0
            ? _chunks.slice(0, _chunks.indexOf(null)) : _chunks) as S[];
        const currentChunksResult = chunksToBeProcessed.map(chunk => this.strict ? this.makeStrictTransformChain(chunk) : this.makeTransformChain(chunk));

        this.processing.push(
            ...this.makeProcessingItems(chunkBeforeThisOne, currentChunksResult, chunksToBeProcessed)
        );
        trace('DRAIN WRITEV:');
        trace(drain);

        if (chunksToBeProcessed !== _chunks) return drain ? drain.then(() => this.end()) : this.end();

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
                if (result !== undefined) {
                    trace('IFCA-WRITE_RESULT', result);
                    if (this.readers.length === 0 || this.readers[0][0] === noop) {
                        if (this.readers.length) this.readers.shift();
                        this.readable.push(result);
                        trace("IFCA-WRITE_PROCESSING_PUSH", this.readable.length, result)
                    } else {
                        this.processing.shift();
                        (this.readers.shift() as ChunkResolver<T>)[0](result)
                        trace("IFCA-WRITE_PROCESSING_SET_READER", this.readers.length, result)
                    } 
                } else {
                    trace("IFCA-WRITE_PROCESSING_UNDEFINED")
                }
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
    
    /**
     * Takes chunk and applies transformations
     * 
     * @param {Object} _chunk 
     * @returns {Promise}
     */
    private makeTransformChain(_chunk: S): Promise<T> {
        let ret: Promise<T> = (this.transformHandlers as TransformHandler<any, any>[])
            .reduce(
                /**
                 * Reducer function that executes all transformations
                 * 
                 * @param {Promise} prev Chunk resolved as promise
                 * @param {Array} param
                 * @param {TransformationFunction} param._executor - Transformation Function
                 * @param {TransformErrorHandler} param._handler - Transformation Error Handler
                 * 
                 * @returns {Promise} 
                 */
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

    /**
     * End
     * 
     * Sets `this.ended` as `true`. Resolves all promises pending in processing and calls `handleEnd` method.
     * 
     * @throws {Error} Throws error if called multiple times
     * @returns {MaybePromise}
     */
    end(): MaybePromise<void> {
        if (this.ended) throw new Error("End called multiple times");

        this.ended = true;
        
        if (this.processing.length > 0) 
            return Promise.all(this.processing)
                .then(() => { this.handleEnd() });
        this.handleEnd();
    }

    /**
     * This resolves all readers beyond those being processed.
     * 
     * @returns {null}
     */
    private handleEnd() {
        trace("IFCA-HANDLE_END()")
        this.readers.slice(this.processing.length).forEach(([res]) => res(null));
        this.readable.push(null as unknown as T);
        return null;
    }

    /**
     * Read
     * 
     * @returns {MaybePromise}
     */
    read(): MaybePromise<T|null> {
        trace('IFCA-READ()')
        const ret = this.processing.shift();
        if (this.readable.length > 0) {
            if (this.readable[0] === null) {
                // TODO: this makes nulls precede data
                trace('IFCA-READ READABLE-NULL')
                return null;
            }
            trace('IFCA-READ READABLE-EXISTS');
            return this.readable.shift() as T;
        }
        else if (ret) {
            trace('IFCA-READ PROCESSING-AWAIT');
            this.readers.push([noop])
            return ret.then(() => {
                trace('IFCA-READ PROCESSING-SHIFT', this.readable[0]);
                return this.readable.shift() as T
            });
        }
        else if (this.ended) {
            trace('IFCA-READ ENDED', ret);
            return null;
        }

        trace('IFCA-READ CREATE_READER');
        // This gives Promise { <pending> }
        // In scribbe.spec.js this never resolves
        return new Promise((...handlers) => {
            trace('IFCA-READ INSIDE PROMISE');
            trace('READERS', this.readers);
            // push both [resolve, reject]
            return this.readers.push(handlers);
        });
    }

    /**
     * Return last processing item
     * 
     * @returns {PromiseLike}
     */
    last(): PromiseLike<T> { 
        return this.processing[this.processing.length - 1];
    }

    /**
     * Add error handler
     * 
     * @param {TransformErrorHandler} handler Transform error handler
     * @returns {IFCA}
     */
    addErrorHandler(handler: TransformErrorHandler<S,T>): this {
        this.transformHandlers.push([, handler]);

        return this;
    }

    /**
     * Add transform
     * 
     * @param {TransformFunction} transform Transform function
     * @param {TransformErrorHandler} [handler] Optional transform error handler
     * @returns {IFCA}
     */
    addTransform<W>(transform: TransformFunction<T, W>, handler?: TransformErrorHandler<T, W>): IFCA<S, W, this> {
        (this.transformHandlers as any[]).push([transform, handler]);
        return this as IFCA<S,unknown,any> as IFCA<S,W,this>;
    }

    /**
     * Remove transform (pop)
     * 
     * @returns {IFCA}
     */
    removeTransform(): I {
        this.transformHandlers.shift();
        return this as IFCA<S,unknown,any> as I;
    }

}
