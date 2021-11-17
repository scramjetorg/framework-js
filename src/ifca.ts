import { cpus } from "os";
import { DroppedChunk, MaybePromise, ResolvablePromiseObject, TransformFunction, TransformErrorHandler, TransformHandler, IFCAOptions } from "./types";
import { trace, createResolvablePromiseObject, isAsyncTransformHandler } from "./utils";

class ProcessingQueue<T> {

    /**
     * Ready chunks waitng to be read.
     */
    private _ready: T[] = [];

    /**
     * Awaitng chunk requests.
     */
    private _requested: Object[] = [];

    /**
     * Number of chunks processed at the given moment.
     */
    private _pendingLength: number = 0;

    /**
     * Whenever the queue is closed.
     */
    private _hasEnded: Boolean = false;

    /**
     * Last chunk which was pushed to the queue.
     */
    private previousChunk: Promise<T | void> = Promise.resolve();

    /**
     * @returns {number} Number of chunks (both being processed and ready) in the queue at the given moment.
     */
    get length(): number {
        return this._pendingLength + this._ready.length;
    }

    /**
     * @returns {number} Number of chunks processed at the given moment.
     */
    get pendingLength(): number {
        return this._pendingLength;
    }

    /**
     * @returns {number} Number of ready chunks at the given moment.
     */
    get readyLength(): number {
        return this._ready.length;
    }

    /**
     * Last chunk which was pushed to the queue.
     * If there were no chunks pushed, resolved promise is returned.
     *
     * @returns {Promise<T|void>} Last chunk from the queue.
     */
    get last(): Promise<T|void> {
        return this.previousChunk;
    }

    /**
     * Adds chunk promise to the queue.
     *
     * @param {Promise<T>} chunkResolver Promise resolving to a chunk.
     * @returns {void}
     */
    push(chunkResolver: Promise<T>): void {
        // We don't need to worry about chunks resolving order since it is guaranteed
        // by IFCA with Promise.all[previousChunk, currentChunk].
        chunkResolver.then((result: T) => {
            this._pendingLength--;

            if (result as any !== DroppedChunk) {
                this._ready.push(result);

                // If there is any chunk requested (read awaiting) resolve it.
                if (this._requested.length) {
                    const chunkRequest: any = this._requested.shift();

                    chunkRequest.resolver(this._ready.shift() as T);
                }
            }

            // If queue is closed and there are no more pending items we need to make sure
            // to resolve all waiting chunks requests (with nulls since there is no more data).
            if (this._hasEnded) {
                this.resolveAwaitingRequests();
            }
        });

        this._pendingLength++;

        this.previousChunk = chunkResolver;
    }

    /**
     * Reads chunk from the queue.
     *
     * If there are ready chunks waiting, value is returned. If not, a promise
     * which will resolved upon next chunk processing completes is returned.
     *
     * If the queue is closed and no more data avaialbe, `null`s are retruned.
     *
     * @returns {MaybePromise<T|null>} Promise resolving to a chunk or chunk.
     */
    read(): MaybePromise<T|null> {
        // If chunk is ready, simply return it.
        if (this._ready.length) {
            // TODO handle nulls?

            return this._ready.shift() as T;
        }

        // Add chunk request to a queue if:
        // * queue is not closed and there are no ready chunks
        // * queue is closed but there are still pending chunks
        if (!this._hasEnded || this._hasEnded && this._pendingLength > 0) {
            const chunkRequest = createResolvablePromiseObject();

            this._requested.push(chunkRequest);
            return chunkRequest.promise as Promise<T>;
        }

        return null;
    }

    /**
     * Closes the queue and resolves all awaiting chunk requests.
     *
     * @returns {void}
     */
    close() {
        this._hasEnded = true;
        this.resolveAwaitingRequests();
    }

    /**
     * Resolves all awaiting chunk requests which cannot be resolved due to end of data.
     *
     * @returns {void}
     */
    private resolveAwaitingRequests() {
        if (this._hasEnded && this._pendingLength === 0 && this._requested.length > 0) {
            for (const chunkRequest of this._requested) {
                (chunkRequest as any).resolver(null);
            }
        }
    }
}
export interface IIFCA<S, T, I extends IIFCA<S, any, any>> {
    // TODO: make these two into one array of `ChunkResolver`s
    // transforms: TransformArray<S, T>;
    // handlers: TransformErrorHandler<S, T>[];

    transformHandlers: TransformHandler<S, T>[];

    /**
     * Write (add chunk)
     *
     * https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1
     * All Writable stream implementations must provide a writable._write() and/or writable._writev()
     * method to send data to the underlying resource.
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
    addTransform<W>(tr: TransformFunction<S, W>, err?: TransformErrorHandler<S, W>): IIFCA<S, W, this>;

    /**
     * Remove transform (pop)
     *
     * @returns {IFCA}
     */
    removeTransform(): I;
}

type ChunkResolver<S> = [TransformFunction<S|null, void>, TransformErrorHandler<S, void>?];

export class IFCA<S, T=S, I extends IFCA<S, any, any>=IFCA<S, any, any>> implements IIFCA<S, T, I> {

    /**
     * Creates new IFCA instances.
     *
     * ```javascript
     * const ifca = new IFCA({ maxParallel: 4, strict: false });
     * ```
     *
     * @param {IFCAOptions} [options] options
     */
    constructor(
        options: IFCAOptions
    ) {
        this.maxParallel = options.maxParallel === undefined ? 2 * cpus().length : options.maxParallel;
        this.strict = options.strict === undefined ? true : !!options.strict;
        this.ordered = options.ordered === undefined ? true : !!options.ordered;
    }

    /**
     * Defines how many chunks can be processed by IFCA at the same time. Both chunks that are being
     * currently procesed by transforms and those waiting to be read are counted to maxParallel.
     */
    maxParallel: number;

    /**
      * Whether all synchronous transformations which occurs one after another should be processed
      * synchronosuly (wrapped into single syncrhonus function) or should be chained with 'await' statemnet in-between.
      */
    strict: boolean;

    /**
      * Whether IFCA should keep order of input/output chunks (ala FIFO queue) or just make chunks available as soon
      * as they are ready (FRFO - first ready first out).
      */
    ordered: boolean;

    /**
     * Transformation Handlers Array
     */
    transformHandlers: TransformHandler<S, T>[] = [];

    // transforms: TransformArray<S, T>;
    // public handlers = [] as TransformErrorHandler<S,T>[];

    private processingQueue: ProcessingQueue<T> = new ProcessingQueue();
    private readers: ChunkResolver<T>[] = [];
    private ended: boolean = false;
    private endedPromise: Promise<void> | null = null;
    private endedPromiseResolver: Function | null = null;
    private drain: ResolvablePromiseObject<void> | undefined = undefined;

    get state() {
        return {
            all: this.processingQueue.length,
            pending: this.processingQueue.pendingLength
        };
    }

    /**
     * @returns {boolean} Whether there are any ready chunks waiting to be read.
     */
    get hasReadyChunks(): boolean {
        return this.processingQueue.readyLength > 0;
    }

    /**
     * Write (add chunk)
     *
     * Once processing reaches maxParallel then write method returns drain (pending promise).
     * Otherwise undefined is returned
     *
     * https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1
     * All Writable stream implementations must provide a writable._write() and/or writable._writev()
     * method to send data to the underlying resource.
     *
     * @param {Object|null} _chunk The data to be written
     * @returns {MaybePromise} Drain value.
     */
    write(_chunk: S|null): MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");
        if (_chunk === null) return this.end();

        const chunkBeforeThisOne = this.processingQueue.last as any;
        const currentChunkResult = this.strict
            ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);

        this.processingQueue.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult));

        if (this.processingQueue.length >= this.maxParallel && this.drain === undefined) {
            this.drain = createResolvablePromiseObject<void>();
        }

        trace("DRAIN WRITE:", this.drain);

        return this.drain ? this.drain.promise as Promise<void> : undefined;
    }

    /**
     * Write array of chunks
     *
     * Basically copy of write method that instead of one chunk can process array of chunks.
     *
     * https://nodejs.org/api/stream.html#stream_writable_writev_chunks_callback
     * All Writable stream implementations must provide a writable._write() and/or writable._writev()
     * method to send data to the underlying resource.
     *
     * @param {Object[]|null}_chunks The data to be written. The value is an array of <Object> that each
     * represent a discrete chunk of data to write.
     * @returns {MaybePromise}  Drain value.
     */
    writev(_chunks: (S|null)[]): MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");

        // TODO how do we treat 'null's inside _chunks array?
        // * one or multiple nulls at the beginning
        // * nulls between data
        // * nulls at the end

        const chunksToBeProcessed = (_chunks.indexOf(null) >= 0
            ? _chunks.slice(0, _chunks.indexOf(null)) : _chunks) as S[];

        chunksToBeProcessed.forEach(_chunk => {
            const chunkBeforeThisOne = this.processingQueue.last as any;
            const currentChunkResult = this.strict
                ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);

            this.processingQueue.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult));
        });

        if (this.processingQueue.length >= this.maxParallel && this.drain === undefined) {
            this.drain = createResolvablePromiseObject<void>();
        }

        trace("DRAIN WRITE:", this.drain);

        return this.drain ? this.drain.promise as Promise<void> : undefined;
    }

    /**
     * Creates chain of asyncrhonous transformation calls where result of the previous one
     * is passed to the next one.
     *
     * @param {S} _chunk Chunk to be transformed.
     * @returns {MaybePromise<T>} Transformation chain.
     */
    private makeTransformChain(_chunk: S): MaybePromise<T> {
        const transforms = this.transformHandlers as TransformHandler<any, any>[];

        return this.chainAsynchronousTransforms<S, any>(transforms, _chunk)(_chunk);
    }

    /**
     * Creates chain of transformation calls where result of the previous one
     * is passed to the next one.
     *
     * Synchronous functions are grouped and called at once.
     *
     * @param {S} _chunk Chunk to be transformed.
     * @returns {MaybePromise<T>} Transformation chain.
     */
    private makeStrictTransformChain(_chunk: S): MaybePromise<T> {
        const funcs = [...this.transformHandlers] as TransformHandler<any, any>[];

        let value: any = _chunk;
        let transforms: TransformHandler<any, any>[] = [];
        let isPrevFuncSync: boolean = true;

        // Loops over transforms array and as long as transforms are of the same type groups them.
        // If next transform is of different type, previous group is transformed into chain.
        while (funcs.length) {
            const func = funcs.shift() as TransformHandler<any, any>;
            const isFuncSync = !isAsyncTransformHandler(func);

            if (transforms.length && isFuncSync !== isPrevFuncSync) {
                value = this.mergeTransformChains(value, transforms, _chunk, isPrevFuncSync);
                transforms = [];
            }

            if (value === DroppedChunk) {
                transforms = [];
                break;
            }

            transforms.push(func);

            isPrevFuncSync = isFuncSync;
        }

        if (transforms.length) {
            value = this.mergeTransformChains(value, transforms, _chunk, isPrevFuncSync);
        }

        return value;
    }

    /**
     * Creates transform chain of a given type (sync or async) and attaches it to the one provided.
     * This results in creation of a single transform chain.
     *
     * @param {any} transformChain Existing transform chain.
     * @param {TransformHandler<any, any>[]} transforms Transforms to be chained ane merged to `transfromChain`.
     * @param {S} initialChunk Initial chunk.
     * @param {boolean} synchronous Whether new transforms are synchronous.
     * @returns {MaybePromise} New transform chain.
     */
    private mergeTransformChains(
        transformChain: any,
        transforms: TransformHandler<any, any>[],
        initialChunk: S,
        synchronous: boolean = true
    ): MaybePromise<T> {
        const isPromise = transformChain instanceof Promise;

        if (synchronous) {
            return isPromise ? transformChain.then(this.chainSynchronousTransforms(transforms, initialChunk))
                : this.chainSynchronousTransforms(transforms, initialChunk)(transformChain);
        }
        if (!isPromise) {
            transformChain = Promise.resolve(transformChain);
        }
        return transformChain.then(this.chainAsynchronousTransforms(transforms, initialChunk));

    }

    // TODO: here's a low hanging fruit for implementing non-ordered processings
    /**
     *
     * @param {Promise} chunkBeforeThisOne previous chunk
     * @param {MaybePromise} currentChunkResult current chunk
     * @returns {Promise} promise
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
            })
            .finally(() => {
                trace("IFCA ON-CHUNK-RESOLVED", this.processingQueue.length, this.maxParallel, this.drain);
                if (this.processingQueue.length < this.maxParallel && this.drain !== undefined) {
                    this.drain.resolver();
                    this.drain = undefined;
                }
            });
    }

    private attachErrorHandlerToChunkResult(currentChunkResult: MaybePromise<T>): MaybePromise<T> {
        if (currentChunkResult instanceof Promise) {
            currentChunkResult.catch((err: Error) => {
                if (!err) {
                    return;
                }

                // TODO - readers are no longer used so this needs to handled in ProcessingQueue
                // Looks like it passes caught error to reader (first in the queue) error handler
                // as reader should be (since it's still TODO) [transform, handler].
                // This needs to be reworked.
                if (this.readers.length) {
                    const res = this.readers[0];

                    if (res[1]) {
                        this.readers.shift();
                        // TODO: this potentially throws?
                        /* eslint-disable consistent-return */
                        return res[1](err);
                    }
                }
                throw err;
            });
        }

        return currentChunkResult;
    }

    /**
     * Creates synchronous transforms chain. Returns a function
     * which runs all the transforms when called.
     *
     * @param {TransformHandler} funcs Transform functions.
     * @param {X} processingChunk Chunk to be processed.
     * @returns {Function} Synchronous transforms chain.
     */
    private chainSynchronousTransforms<X, Y>(funcs: TransformHandler<X, Y>[], processingChunk: X): (a: X) => Y {
        return (a: X): Y => {
            let value: any = a;

            for (const [executor, handler] of funcs) {
                try {
                    if (executor) {
                        value = executor(value as any);
                    }
                    if (value === DroppedChunk) {
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
     * Creates asynchronous transforms chain. Returns an asynchronous function
     * which runs all the transforms when called.
     *
     * @param {TransformHandler} funcs Transform functions.
     * @param {X} processingChunk Chunk to be processed.
     * @returns {Promise} Asynchronous transforms chain.
     */
    private chainAsynchronousTransforms<X, Y>(
        funcs: TransformHandler<X, Y>[],
        processingChunk: X
    ): (a: X) => Promise<Y> {
        return async (a: X): Promise<Y> => {
            let value: any = await a;

            for (const [executor, handler] of funcs) {
                try {
                    if (executor) {
                        value = await executor(value);
                    }
                    if (value === DroppedChunk) {
                        break;
                    }
                } catch (err) {
                    if (typeof err === "undefined") {
                        value = await Promise.reject(undefined);
                    } else if (handler) {
                        value = await handler(err as any, processingChunk);
                    } else {
                        throw err;
                    }
                }
            }

            return value as Promise<Y>;
        };
    }

    /**
     * End
     *
     * Sets `this.ended` as `true`. Resolves all promises pending in processing and calls `handleEnd` method.
     *
     * @throws {Error} Throws error if called multiple times
     * @returns {MaybePromise} Promise resolving when all pending chunks are processed
     * or undefined if there are no chunks waiting.
     */
    end(): MaybePromise<void> {
        if (this.ended) {
            throw new Error("End called multiple times");
        }

        this.processingQueue.close();

        this.ended = true;

        const onEnd = () => {
            if (this.endedPromiseResolver) {
                this.endedPromiseResolver();
            }
        };

        if (this.processingQueue.pendingLength > 0) {
            return this.processingQueue.last.then(onEnd);
        }

        return onEnd();
    }

    /**
     * Reads processing results.
     *
     * @returns {MaybePromise|null} Promise resolving to a chunk value or chunk value.
     */
    read(): MaybePromise<T|null> {
        const chunk = this.processingQueue.read();

        // Handles 2 cases:
        // * When IFCA is ended (with queue above maxParallel) and then after some time
        //   read is called. If queue length drops below maxParallel, this.drain should resolve.
        // * When N items (where N == maxParallel) are written to IFCA, processed (so all are ready)
        //   and the read is called. So in such case read is the only place we can check and resolve drain.
        if (this.processingQueue.length < this.maxParallel && this.drain !== undefined) {
            this.drain.resolver();
            this.drain = undefined;
        }

        return chunk;
    }

    /**
     * Adds error handler.
     *
     * @param {TransformErrorHandler} handler Transform error handler
     * @returns {IFCA} This IFCA instance
     */
    addErrorHandler(handler: TransformErrorHandler<S, T>): this {
        this.transformHandlers.push([undefined, handler]);
        return this;
    }

    /**
     * Adds transform.
     *
     * @param {TransformFunction} transform Transform function
     * @param {TransformErrorHandler} [handler] Optional transform error handler
     * @returns {IFCA} Mutated IFCA instance.
     */
    addTransform<W, Args extends any[] = []>(
        transform: TransformFunction<S, W, Args>,
        handler?: TransformErrorHandler<S, W>
    ): IFCA<S, W, this> {
        (this.transformHandlers as any[]).push([transform, handler]);
        return this as IFCA<S, unknown, any> as IFCA<S, W, this>;
    }

    /**
     * Removes transform.
     *
     * @returns {IFCA} Mutated IFCA instance.
     */
    removeTransform(): I {
        this.transformHandlers.shift();
        return this as IFCA<S, unknown, any> as I;
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
