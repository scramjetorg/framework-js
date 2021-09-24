/* eslint-disable */
import { cpus } from "os";
import { trace } from "../utils"

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)
export type TransformErrorHandler<S, T> = (err: ErrorWithReason|undefined, chunk?: S) => MaybePromise<T|undefined>;
export type IFCAOptions = Partial<{ strict: boolean }>
export type ErrorWithReason = Error & { cause?: Error };
export type TransformArray<S, T> = [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    TransformFunction<any, T>,
    ...TransformFunction<any, any>[]
];
export const DroppedChunk = Symbol("DroppedChunk");

const isAsync = (func: any[]) => func.length && (
    func[0] && func[0][Symbol.toStringTag] === 'AsyncFunction' ||
    func[1] && func[1][Symbol.toStringTag] === 'AsyncFunction');

// const noop = () => { };

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
    // readable is a queue of chunks waiting to be reAD
    private readable: NullTerminatedArray<T[]> = [];
    // readers is a queue of "read calls" waiting to receive value
    private readers: ChunkResolver<T>[] = [];
    private ended: boolean = false;
    private readonly strict: boolean;
    private endedPromise: Promise<void> | null = null;
    private endedPromiseResolver: Function | null = null;

    private processingQueue: ProcessingQueue<T> = new ProcessingQueue();

    //TBD
    get status() {
        return "R,".repeat(this.readers.length) + this.processing.slice(this.readers.length).map((x,i) => this.readable[this.readers.length + i] ? 'd,' : 'p,')
    }

    //private resulting
    //processing.push(chain)
    //resulting.push({promise,resolver})

    //read reads resulting promises which are resolved only by non dropped chunks
    //what about ending stream and promises returning nulls?

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

        const pendingLength = this.processingQueue.length;
        trace('IFCA WRITE pos: ', pendingLength, _chunk)
        const drain: MaybePromise<any> = pendingLength < this.maxParallel
            ? undefined
            : this.processingQueue.get(pendingLength - this.maxParallel).finally()
        ;
        const chunkBeforeThisOne = this.processingQueue.last as any;
        const currentChunkResult = this.strict ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);

        /**
         * Make processing item and push to processing array in order to start processing transformations.
         */
        this.processingQueue.push(
            this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult)
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
    // TBD
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
            ...this.makeProcessingItems(chunkBeforeThisOne, currentChunksResult)
        );
        trace('DRAIN WRITEV:');
        trace(drain);

        if (chunksToBeProcessed !== _chunks) return drain ? drain.then(() => this.end()) : this.end();

        return drain;
    }

    /**
     * Same as `makeProcessingItem` but accepts array of chunks. Processes many items.
     *
     * @param {Promise} chunkBeforeThisOne
     * @param {MaybePromise[]} currentChunksResult
     * @returns {Promise[]}
     */
    private makeProcessingItems(chunkBeforeThisOne: Promise<any>, currentChunksResult: MaybePromise<T>[]): Promise<any>[] {
        const result:MaybePromise<any>[] = [];
        result.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunksResult[0]));
        for (let i = 1; i < currentChunksResult.length; i++) {
            result.push(this.makeProcessingItem(currentChunksResult[i - 1] as Promise<T>, currentChunksResult[i]))
        }

        return result;
    }

    // TODO: here's a low hanging fruit for implementing non-ordered processing
    /**
     *
     * @param {Promise} chunkBeforeThisOne
     * @param {MaybePromise} currentChunkResult
     * @returns {Promise}
     */
    private makeProcessingItem(chunkBeforeThisOne: Promise<any>, currentChunkResult: MaybePromise<T>): Promise<any> {
        return Promise.all([
            chunkBeforeThisOne?.finally(),
            this.attachErrorHandlerToChunkResult(currentChunkResult)
        ])
            .then(([, result]) => {
                return result;
            })
            .catch(e => {
                if (typeof e === "undefined") return;
                throw e;
            });
    }

    private attachErrorHandlerToChunkResult(currentChunkResult: MaybePromise<T>): MaybePromise<T> {
        if (currentChunkResult instanceof Promise) {
            currentChunkResult.catch((err: Error) => {
                if (!err) {
                    return;
                }

                if (this.readers.length) {
                    const res = this.readers[0];

                    if (res[1]) {
                        this.readers.shift();
                        // TODO: this potentially throws?
                        return res[1](err);
                    }
                }
                throw err;
            });
        }

        return currentChunkResult;
    }

    private makeStrictTransformChain(_chunk: S): MaybePromise<T> {
        trace('IFCA makeStrictTransformChain');
        let funcs = [...this.transformHandlers] as TransformHandler<any, any>[];
        if (!funcs.length) return _chunk as unknown as T;

        let value: any = _chunk;

        // Find first async function
        const firstAsyncFunctions = funcs.findIndex(isAsync);
        // Only sync functions
        if (firstAsyncFunctions === -1) {
            return this.makeSynchronousChain(funcs, _chunk)(value);
        }

        // First X funcs are sync
        if (firstAsyncFunctions > 0) {
            value = this.makeSynchronousChain(funcs.slice(0, firstAsyncFunctions), _chunk)(value);
            funcs = funcs.slice(firstAsyncFunctions);
        }

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
        // return funcs.reduce.bind(funcs, (prev, [transformFn, errorHandler]) => {
        //     try {
        //         return transformFn ? transformFn(prev as any) : prev;
        //     } catch(err) {
        //         if (typeof err === "undefined") {
        //             return;
        //         }
        //         if (errorHandler) {
        //             return errorHandler(err, processingChunk);
        //         }
        //         throw err;
        //     }
        // }) as (a: X) => Y;

        return () : Y => {
            let value: any = processingChunk;

            trace('IFCA makeSynchronousChain');

            for (const [executor, handler] of funcs) {
                try {
                    if (executor) {
                        value = executor(value as any);
                    }
                    console.log("MSC", value);
                    if (value === DroppedChunk) {
                        console.log('DROPPED-CHUNK');
                        break;
                    }
                } catch (err) {
                    if (typeof err !== "undefined") {
                        if (handler) {
                            value = handler(err as any, processingChunk);
                        } else {
                            throw err;
                        }
                    } else {
                        value = undefined;
                    }
                }
            }

            return value as Y;
        };
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
        if (this.ended) {
            throw new Error("End called multiple times");
        }

        this.processingQueue.close();

        this.ended = true;

        if (this.processingQueue.length > 0) {
            return Promise.all(this.processingQueue.all).then(() => { this.endedPromiseResolver && this.endedPromiseResolver() });
        }

        this.endedPromiseResolver && this.endedPromiseResolver()
    }

    /**
     * Reads processing results.
     *
     * @returns {MaybePromise|null}
     */
    read(): MaybePromise<T|null> {
        return this.processingQueue.read();
    }

    /**
     * Adds error handler.
     *
     * @param {TransformErrorHandler} handler Transform error handler
     * @returns {IFCA}
     */
    addErrorHandler(handler: TransformErrorHandler<S,T>): this {
        this.transformHandlers.push([, handler]);
        return this;
    }

    /**
     * Adds transform.
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
     * Removes transform.
     *
     * @returns {IFCA}
     */
    removeTransform(): I {
        this.transformHandlers.shift();
        return this as IFCA<S,unknown,any> as I;
    }

    whenEnded(): Promise<void> {
        if (!this.endedPromise) {
            this.endedPromise = new Promise(res => {
                this.endedPromiseResolver = res;
            });
        }

        return this.endedPromise;
    }

}
class ProcessingQueue<T> {

    private hasStarted: Boolean = false;
    private hasEnded: Boolean = false;
    private pending: Promise<T>[] = [];
    private ready: T[] = [];
    private requested: Object[] = [];

    get length(): number {
        return this.pending.length;
    }

    get last(): Promise<T|void> | null {
        if (this.pending.length) {
            return this.pending[this.pending.length - 1];
        }

        // Instead of returning undefined on empty, not started queue return resolved promise.
        if (!this.hasStarted) {
            return Promise.resolve();
        }

        return null;
    }

    // Returns all pending chunks.
    get all(): Promise<T>[] {
        return this.pending;
    }

    // Returns pending chunk from the given position.
    get(index: number) {
        return this.pending[index];
    }

    // We don't need to worry about chunks resolving order since it is guaranteed
    // by IFCA with Promise.all[previousChunk,currentChunk].
    push(chunkResolver: Promise<T>): void {
        chunkResolver.then((result: T) => {
            this.pending.shift();
            this.ready.push(result); // TBD here we will check reult for DroppedChunks

            // If there is any chunk requested (read awaiting) resolve it.
            if (this.requested.length) {
                const chunkRequest: any = this.requested.shift();
                chunkRequest.resolver(this.ready.shift() as T);
            }

            // If queue is closed and there are no more pending items we need to make sure
            // to resolve all waiting chunks requests (with nulls since there is no more data).
            this.hasEnded && this.resolveAwaitingRequests();
        });

        this.hasStarted = true;

        this.pending.push(chunkResolver);
    }

    // Requesting read from the queue.
    read(): MaybePromise<T|null> {
        // If chunk is ready, simply return it.
        if (this.ready.length) {
            // TBD handle nulls as in line 468

            return this.ready.shift() as T;
        }

        // If queue is not closed and there are no ready chunks
        // add chunk request which will be resolved when next chunk becomes available.
        if (!this.hasEnded) {
            const chunkRequest = this.createChunkRequest();
            this.requested.push(chunkRequest);
            return chunkRequest.promise as Promise<T>;
        }

        // If queue is closed but there are still pending chunks
        // add chunk request.
        if (this.hasEnded && this.pending.length > 0) {
            const chunkRequest = this.createChunkRequest();
            this.requested.push(chunkRequest);
            return chunkRequest.promise as Promise<T>;
        }

        return null;
    }

    // Closes the queue.
    close() {
        this.hasEnded = true;
        this.resolveAwaitingRequests();
    }

    // Creates chunk request promise which can be directly resolved by the outside call.
    private createChunkRequest() {
        let resolver = undefined;
        const promise = new Promise( res => {
            resolver = res;
        } );

        return { promise, resolver };
    }

    // Resolves all chunk awaiting requests which cannot be resolved due to end of data.
    private resolveAwaitingRequests() {
        if (this.hasEnded && this.pending.length === 0 && this.requested.length > 0) {
            for (const chunkRequest of this.requested) {
                (chunkRequest as any).resolver(null);
            }
        }
    }
}
