import { cpus } from "os";
import { DroppedChunk, MaybePromise, ResolvablePromiseObject, TransformFunction, TransformErrorHandler, TransformHandler, IFCAOptions } from "./types";
import { trace, createResolvablePromiseObject, isAsyncTransformHandler, getId } from "./utils";
import { ProcessingQueue } from "./ifca/processing-queue";

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
    addTransform<W>(tr: TransformFunction<T, W>, err?: TransformErrorHandler<T, W>): IIFCA<S, W, this>;

    /**
     * Remove transform (pop)
     *
     * @returns {IFCA}
     */
    removeTransform(): I;
}

export class IFCA<S, T=S, I extends IFCA<S, any, any>=IFCA<S, any, any>> implements IIFCA<S, T, I> {

    /**
     * Creates new IFCA instance.
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
     * IFCA unique id.
     */
    private id: string = getId("IFCA:IFCA");

    /**
     * Defines how many chunks can be processed by IFCA at the same time. Both chunks that are being
     * currently procesed by transforms and those waiting to be read are counted to maxParallel.
     */
    private maxParallel: number;

    /**
      * Whether all synchronous transformations which occurs one after another should be processed
      * synchronosuly (wrapped into single syncrhonus function) or should be chained with 'await' statemnet in-between.
      */
    private strict: boolean;

    /**
      * Whether IFCA should keep order of input/output chunks (ala FIFO queue) or just make chunks available as soon
      * as they are ready (FRFO - first ready first out).
      */
    private ordered: boolean;

    /**
     * Transformation Handlers Array
     */
    transformHandlers: TransformHandler<S, T>[] = [];

    // transforms: TransformArray<S, T>;
    // public handlers = [] as TransformErrorHandler<S,T>[];

    private processingQueue: ProcessingQueue<T> = new ProcessingQueue(this.getDrainResolver());
    private ended: boolean = false;
    private drain: ResolvablePromiseObject<void> | undefined = undefined;

    get state() {
        return {
            id: this.id,
            all: this.processingQueue.length,
            pending: this.processingQueue.pendingLength,
            maxParallel: this.maxParallel,
            strict: this.strict,
            ordered: this.ordered
        };
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
        trace("IFCA-WRITE_TRY", _chunk, this.state);

        if (this.ended) throw new Error("Write after end");
        if (_chunk === null) return this.end();

        trace("IFCA-WRITE", _chunk, this.state);

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
        synchronous: boolean
    ): MaybePromise<T> {
        const isPromise = transformChain instanceof Promise;

        if (synchronous) {
            return isPromise ? transformChain.then(this.chainSynchronousTransforms(transforms, initialChunk))
                : this.chainSynchronousTransforms(transforms, initialChunk)(transformChain);
        }

        return Promise.resolve(transformChain).then(this.chainAsynchronousTransforms(transforms, initialChunk));

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
            chunkBeforeThisOne && chunkBeforeThisOne.finally(),
            this.attachErrorHandlerToChunkResult(currentChunkResult)
        ])
            .then(([, result]) => {
                return result;
            })
            .catch(e => {
                // Below is ignored since we are not able to test it properly due to incorrect error handling.
                /* istanbul ignore if */
                if (typeof e !== "undefined") {
                    // @TODO
                    // This just rethrows error thrown by transform function in 'chainAsynchronousTransforms()'
                    // which cannot be caught correctly.
                    throw e;
                }
            });
    }

    private attachErrorHandlerToChunkResult(currentChunkResult: MaybePromise<T>): MaybePromise<T> {
        if (currentChunkResult instanceof Promise) {
            currentChunkResult.catch((err: Error) => {
                // Below is ignored since we are not able to test it properly due to incorrect error handling.
                /* istanbul ignore if */
                if (err) {
                    // @TODO
                    // This just rethrows error thrown by transform function in 'chainAsynchronousTransforms()'
                    // which cannot be caught correctly.
                    throw err;
                }
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
                    // Below is ignored since we are not able to test it properly due to incorrect error handling.
                    /* istanbul ignore else */
                    if (typeof err === "undefined") {
                        value = await Promise.reject(undefined);
                    } else if (handler) {
                        value = await handler(err as any, processingChunk);
                    } else {
                        // Since transforms are run kind of in background, this rethrown error cannot be
                        // caught by e.g. "try { ifca.write(...) } catch (err) { ... }"
                        throw err;
                    }
                }
            }

            return value as Promise<Y>;
        };
    }

    /**
     * @returns {Function} Callback which when called resolves current drain promise.
     */
    private getDrainResolver() {
        return () => {
            trace("IFCA ON-CHUNK-RESOLVED", this.processingQueue.length, this.maxParallel, this.drain, this.id);

            if (this.processingQueue.length < this.maxParallel && this.drain !== undefined) {
                this.drain.resolver();
                this.drain = undefined;
            }
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

        trace("ENDING IFCA", this.state);

        this.processingQueue.close();

        this.ended = true;

        if (this.processingQueue.pendingLength > 0) {
            return this.processingQueue.last.then();
        }

        return undefined;
    }

    /**
     * Reads processing results.
     *
     * @returns {MaybePromise|null} Promise resolving to a chunk value or chunk value.
     */
    read(): MaybePromise<T|null> {
        return this.processingQueue.read();
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
        transform: TransformFunction<T, W, Args>,
        handler?: TransformErrorHandler<T, W>
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
}
