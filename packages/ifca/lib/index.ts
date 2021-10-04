/* eslint-disable */
import { cpus } from "os";
import { trace, createResolvablePromiseObject, ResolvablePromiseObject } from "../utils"

export type TransformFunction<V, U, W extends any[] = []> = (chunk: V, ...args: W) => (Promise<U>|U)
export type TransformErrorHandler<S, T> = (err: ErrorWithReason|undefined, chunk?: S) => MaybePromise<T|undefined>;
export type IFCAOptions = Partial<{ strict: boolean }>
export type ErrorWithReason = Error & { cause?: Error };
export type TransformArray<S, T> = [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    TransformFunction<any, T>,
    ...TransformFunction<any, any>[]
];
export const DroppedChunk = Symbol("DroppedChunk");

const isSync = (func: any[]) => !!(func.length && (
    func[0] && func[0][Symbol.toStringTag] !== 'AsyncFunction' ||
    func[1] && func[1][Symbol.toStringTag] !== 'AsyncFunction'));

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

    private processingQueue: ProcessingQueue<T> = new ProcessingQueue();
    private readers: ChunkResolver<T>[] = [];
    private ended: boolean = false;
    private readonly strict: boolean;
    private endedPromise: Promise<void> | null = null;
    private endedPromiseResolver: Function | null = null;
    private drain: ResolvablePromiseObject<void> | undefined = undefined;

    get state() {
        return {
            pending: this.processingQueue.length
        }
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

        const chunkBeforeThisOne = this.processingQueue.last as any;
        const currentChunkResult = this.strict ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);

        this.processingQueue.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult));

        if (this.processingQueue.length >= this.maxParallel && this.drain === undefined) {
            this.drain = createResolvablePromiseObject<void>();
        }

        trace('DRAIN WRITE:', this.drain);

        return this.drain ? this.drain.promise as Promise<void> : undefined;
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
    writev(_chunks: (S|null)[]): MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");

        // TODO how do we treat 'null's inside _chunks array?
        // * one or multiple nulls at the beginning
        // * nulls between data
        // * nulls at the end

        const chunksToBeProcessed = (_chunks.indexOf(null) >= 0 ? _chunks.slice(0, _chunks.indexOf(null)) : _chunks) as S[];

        chunksToBeProcessed.forEach(_chunk => {
            const chunkBeforeThisOne = this.processingQueue.last as any;
            const currentChunkResult = this.strict ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);

            this.processingQueue.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult));
        });

        if (this.processingQueue.length >= this.maxParallel && this.drain === undefined) {
            this.drain = createResolvablePromiseObject<void>();
        }

        trace('DRAIN WRITE:', this.drain);

        return this.drain ? this.drain.promise as Promise<void> : undefined;
    }

    /**
     * Creates chain of asyncrhonous transformation calls where result of the previous one
     * is passed to the next one.
     *
     * @param {S} _chunk
     * @returns {MaybePromise<T>}
     */
    private makeTransformChain(_chunk: S): MaybePromise<T> {
        const transforms = this.transformHandlers as TransformHandler<any, any>[];
        return this.makeAsynchronousChain<S,any>(transforms, _chunk)(_chunk);
    }

    /**
     * Creates chain of transformation calls where result of the previous one
     * is passed to the next one.
     *
     * Synchronous functions are grouped and called at once.
     *
     * @param {S} _chunk
     * @returns {MaybePromise<T>}
     */
    private makeStrictTransformChain(_chunk: S): MaybePromise<T> {
        const funcs = [...this.transformHandlers] as TransformHandler<any, any>[];

        let value: any = _chunk;
        let buffer: TransformHandler<any, any>[] = [];
        let isPrevFuncSync: boolean = true;

        // Loops over transforms array and as long as transforms are of the same type groups them.
        // If next transform is of different type, previous group is transformed into chain.
        while (funcs.length)  {
            const func = funcs.shift() as TransformHandler<any, any>;
            const isFuncSync = isSync(func);

            if (buffer.length && isFuncSync !== isPrevFuncSync) {
                value = this.createTransformChain(value, buffer, _chunk, isPrevFuncSync);
                buffer = [];
            }

            if (value === DroppedChunk) {
                buffer = [];
                break;
            }

            buffer.push(func);

            isPrevFuncSync = isFuncSync;
        }

        if (buffer.length) {
            value = this.createTransformChain(value, buffer, _chunk, isPrevFuncSync);
        }

        return value;
    }

    /**
     * Creates synchronous or asynchronous transforms chain according to provided data.
     *
     * @param {any} value
     * @param {TransformHandler<any, any>[]} transforms
     * @param {S} initialChunk
     * @param {boolean} synchronous
     * @returns
     */
    private createTransformChain(value: any, transforms: TransformHandler<any, any>[], initialChunk: S, synchronous: boolean = true): MaybePromise<T> {
        const isPromise = value instanceof Promise;

        if (synchronous) {
            return isPromise ? value.then(this.makeSynchronousChain(transforms, initialChunk)) : this.makeSynchronousChain(transforms, initialChunk)(value);
        } else {
            if (!isPromise) {
                value = Promise.resolve(value);
            }
            return value.then(this.makeAsynchronousChain(transforms, initialChunk));
        }
    }

    // TODO: here's a low hanging fruit for implementing non-ordered processings
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
                trace("IFCA ON-CHUNK-RESOLVED", this.processingQueue.length, this.maxParallel, this.drain);
                if (this.processingQueue.length - 1 < this.maxParallel && this.drain !== undefined) {
                    this.drain.resolver();
                    this.drain = undefined;
                }

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

                // TODO - readers are no longer used so this needs to handled in ProcessingQueue
                // Looks like it passes caught error to reader (first in the queue) error handler
                // as reader should be (since it's still TODO) [transform, handler].
                // This needs to be reworked.
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

    private makeSynchronousChain<X,Y>(funcs: TransformHandler<X, Y>[], processingChunk: X): (a: X) => Y {
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

    private makeAsynchronousChain<X,Y>(funcs: TransformHandler<X, Y>[], processingChunk: X): (a: X) => Promise<Y> {
        return async(a: X): Promise<Y> => {
            let value: any = Promise.resolve(a);

            for (const [executor, handler] of funcs) {
                try {
                    if (value) {
                        value = await value;
                    }
                    if (executor) {
                        value = await executor(value);
                    }
                    if (value === DroppedChunk) {
                        break;
                    }
                } catch (err) {
                    if (typeof err === "undefined") {
                        value = await Promise.reject(undefined);
                    } else {
                        if (handler) {
                            value = await handler(err as any, processingChunk);
                        } else {
                            throw err;
                        }
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
     * @returns {MaybePromise}
     */
    end(): MaybePromise<void> {
        if (this.ended) {
            throw new Error("End called multiple times");
        }

        this.processingQueue.close();

        this.ended = true;

        if (this.processingQueue.length > 0) {
            return this.processingQueue.last.then(() => { this.endedPromiseResolver && this.endedPromiseResolver() });
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
    addTransform<W, Args extends any[] = []>(transform: TransformFunction<T, W, Args>, handler?: TransformErrorHandler<T, W>): IFCA<S, W, this> {
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

    /**
     * Ready chunks waitng to be read.
     */
    private ready: T[] = [];

    /**
     * Awaitng chunk requests.
     */
    private requested: Object[] = [];

    /**
     * Number of chunks processed at the given moment.
     */
    private pendingLength: number = 0;

    /**
     * Whenever the queue is closed.
     */
    private hasEnded: Boolean = false;

    /**
     * Last chunk which was pushed to the queue.
     */
    private previousChunk: Promise<T | void> = Promise.resolve()

    /**
     * Number of chunks processed at the given moment.
     *
     * @returns {number}
     */
    get length(): number {
        return this.pendingLength;
    }

    /**
     * Last chunk which was pushed to the queue.
     * If there were no chunks pushed, resolved promise is returned.
     *
     * @returns {Promise<T|void>}
     */
    get last(): Promise<T|void> {
        return this.previousChunk;
    }

    /**
     * Adds chunk promise to the queue.
     *
     * @param {Promise<T>} chunkResolver
     * @returns {void}
     */
    push(chunkResolver: Promise<T>): void {
        // We don't need to worry about chunks resolving order since it is guaranteed
        // by IFCA with Promise.all[previousChunk, currentChunk].
        chunkResolver.then((result: T) => {
            this.pendingLength--;

            if (result as any !== DroppedChunk) {
                this.ready.push(result);

                // If there is any chunk requested (read awaiting) resolve it.
                if (this.requested.length) {
                    const chunkRequest: any = this.requested.shift();
                    chunkRequest.resolver(this.ready.shift() as T);
                }
            }

            // If queue is closed and there are no more pending items we need to make sure
            // to resolve all waiting chunks requests (with nulls since there is no more data).
            this.hasEnded && this.resolveAwaitingRequests();
        });

        this.pendingLength++;

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
     * @returns {MaybePromise<T|null>}
     */
    read(): MaybePromise<T|null> {
        // If chunk is ready, simply return it.
        if (this.ready.length) {
            // TODO handle nulls?

            return this.ready.shift() as T;
        }

        // Add chunk request to a queue if:
        // * queue is not closed and there are no ready chunks
        // * queue is closed but there are still pending chunks
        if (!this.hasEnded || this.hasEnded && this.pendingLength > 0) {
            const chunkRequest = createResolvablePromiseObject();
            this.requested.push(chunkRequest);
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
        this.hasEnded = true;
        this.resolveAwaitingRequests();
    }

    /**
     * Resolves all awaiting chunk requests which cannot be resolved due to end of data.
     *
     * @returns {void}
     */
    private resolveAwaitingRequests() {
        if (this.hasEnded && this.pendingLength === 0 && this.requested.length > 0) {
            for (const chunkRequest of this.requested) {
                (chunkRequest as any).resolver(null);
            }
        }
    }
}
