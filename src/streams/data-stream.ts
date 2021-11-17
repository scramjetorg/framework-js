import { Readable } from "stream";
import { createReadStream, promises as fs } from "fs";
import { BaseStream } from "./base-stream";
import { IFCA } from "../ifca";
import { createResolvablePromiseObject, isAsyncFunction } from "../utils";
import { AnyIterable, StreamConstructor, DroppedChunk, ResolvablePromiseObject, TransformFunction, MaybePromise, StreamOptions } from "../types";

type Reducer<T, U> = {
    isAsync: boolean,
    value?: U,
    onFirstChunkCallback: Function,
    onChunkCallback: (chunk: T) => MaybePromise<void>
};

export class DataStream<T, Z=T> implements BaseStream<T, Z>, AsyncIterable<Z> {

    constructor(options: StreamOptions = { maxParallel: 4 }) {
        this.ifca = new IFCA<T, Z, any>(options);
        this.corked = createResolvablePromiseObject<void>();
        this.parentStream = null;
    }

    protected ifca: IFCA<T, Z, any>;
    protected corked: ResolvablePromiseObject<void> | null;
    protected parentStream: DataStream<T, any> | null;

    static from<U extends any, W extends DataStream<U>>(
        this: StreamConstructor<W>,
        input: Iterable<U> | AsyncIterable<U> | Readable,
        options?: StreamOptions
    ): W {
        return (new this(options)).readSource(input);
    }

    static fromFile<U extends any, W extends DataStream<U>>(
        this: StreamConstructor<W>,
        path: string,
        options?: StreamOptions
    ): W {
        return (new this(options)).readSource(createReadStream(path, options?.readStream));
    }

    [Symbol.asyncIterator]() {
        if (this.corked) {
            this._uncork();
        }

        return {
            next: async () => {
                const value = await this.ifca.read();

                return Promise.resolve({ value, done: value === null } as IteratorResult<Z, boolean>);
            }
        };
    }

    /**
     * Writes new values to this stream. An equivalent
     * of [native nodejs `.write()` method](https://nodejs.org/api/stream.html#writablewritechunk-encoding-callback).
     *
     * @param {T} chunk Value to be written to a stream.
     * @returns {boolean} Returns `false` if the stream wishes for the calling code to wait
     * before continuing to write additional data; otherwise true.
     */
    write(chunk: T): boolean {
        const drain = this.ifca.write(chunk);

        return !(drain instanceof Promise);
    }

    /**
     * Reads from this stream. An equivalent
     * of [native nodejs streams `.read()` method](https://nodejs.org/api/stream.html#readablereadsize).
     *
     * @returns {Z | null} Value or `null` if there is nothing to read at the moment.
     */
    read(): Z | null {
        if (this.ifca.hasReadyChunks) {
            return this.ifca.read() as Z;
        }

        return null;
    }

    /**
     * Closes this stream. After closing nothing can be written to this stream. An equivalent
     * of [native nodejs `.end()` method](https://nodejs.org/api/stream.html#writableendchunk-encoding-callback).
     *
     * @returns {DataStream} This stream instance.
     */
    end(): DataStream<T, Z> {
        this.ifca.end();

        return this;
    }

    /**
     * Resumes stream if it was paused. An equivalent
     * of [native nodejs `.resume()` method](https://nodejs.org/api/stream.html#readableresume).
     *
     * @returns {DataStream} This stream instance.
     */
    resume(): DataStream<T, Z> {
        if (this.corked) {
            this._uncork();
        }

        return this;
    }

    /**
     * Pauses this stream. An equivalent
     * of [native nodejs `.pause()` method](https://nodejs.org/api/stream.html#readablepause).
     *
     * @returns {DataStream} This stream instance.
     */
    pause(): DataStream<T, Z> {
        if (!this.corked) {
            this._cork();
        }

        return this;
    }

    create(): DataStream<T>;
    create<U>(): DataStream<U>;
    create<U>(): DataStream<U> {
        return new DataStream<U>();
    }

    createChildStream<U>(newIfca?: IFCA<T, U, any>): DataStream<T, U> {
        const childStream = new DataStream<T, U>();

        childStream.parentStream = this;
        childStream.corked = this.corked;

        if (newIfca) {
            childStream.ifca = newIfca;
        }

        return childStream;
    }

    map<U, W extends any[] = []>(callback: TransformFunction<T, U, W>, ...args: W): DataStream<T, U> {
        let transformedIfca: IFCA<T, U, any>;

        if (args?.length) {
            transformedIfca = this.ifca.addTransform(this.injectArgsToCallback<U, typeof args>(callback, args));
        } else {
            transformedIfca = this.ifca.addTransform(callback);
        }

        return this.createChildStream(transformedIfca);
    }

    filter<W extends any[] = []>(callback: TransformFunction<T, Boolean, W>, ...args: W): DataStream<T, Z> {
        const chunksFilter = (chunk: T, result: Boolean) => result ? chunk : DroppedChunk;

        this.ifca.addTransform(
            this.injectArgsToCallbackAndMapResult(callback, chunksFilter, args)
        );

        return this.createChildStream(this.ifca);
    }

    flatMap<W extends any[] = []>(callback: TransformFunction<T, AnyIterable<Z>, W>, ...args: W): DataStream<T, Z>;
    flatMap<U, W extends any[] = []>(callback: TransformFunction<T, AnyIterable<U>, W>, ...args: W): DataStream<T, U>
    flatMap<U, W extends any[] = []>(callback: TransformFunction<T, AnyIterable<U>, W>, ...args: W): DataStream<T, U> {
        // const childStream = this.createChildStream<U>();
        const childStream = new DataStream<T, U>(); // write: T, read: U, IFCA<U, U>
        // chainedIFCA = [IFCA1, IFCA2, IFCA3]
        // this.idIfca = 2; -> this.ifca - getter for this.chainedIFCA[this.idIfca]
        // this.write() -> chainedIfca[0].write(...)
        // this.read() -> chainedIfca[last].read(...)
        // this.parentStream
        //
        // ChainedIFCA
        // addIFCA - returns index
        // getIFCA(index) - returns IFCA by index
        // write - writes to first IFCA
        // read - reads from last IFCA
        //
        //
        // const reader = {
        //     onChunkCallback: async (chunk: T) => {
        //         await childStream.write(chunk);
        //     }
        // };

        // this.getReaderAsyncCallback(false, reader);

        let onChunkCallback: (chunk: T) => Promise<void>;

        // We can have sync/async callback
        // Each can return sync/async iterable
        if (isAsyncFunction(callback)) {
            onChunkCallback = async (chunk: T): Promise<void> => {
                const parts = await callback(chunk, ...args);

                for await (const part of parts) {
                    await childStream.ifca.write(part);
                }
            };
        } else {
            onChunkCallback = async (chunk: T): Promise<void> => {
                const parts = callback(chunk, ...args) as AnyIterable<U>;

                for await (const part of parts) {
                    await childStream.write(part);
                }
            };
        }

        this.getReaderAsyncCallback(false, { onChunkCallback });

        return childStream;
    }

    batch<W extends any[] = []>(callback: TransformFunction<T, Boolean, W>, ...args: W): DataStream<T[]> {
        let currentBatch: T[] = [];
        let aggregator: TransformFunction<T, T[], W>;

        if (isAsyncFunction(callback)) {
            aggregator = async (chunk: T, ...args1: W): Promise<T[]> => {
                const emitBatch = await callback(chunk, ...args1);

                currentBatch.push(chunk);

                let result: T[] = [];

                if (emitBatch) {
                    result = [...currentBatch];
                    currentBatch = [];
                }

                return result;
            };
        } else {
            aggregator = (chunk: T, ...args1: W): T[] => {
                currentBatch.push(chunk);

                let result: T[] = [];

                if (callback(chunk, ...args1)) {
                    result = [...currentBatch];
                    currentBatch = [];
                }

                return result;
            };
        }

        const onEnd = () => {
            return { yield: currentBatch.length > 0, value: currentBatch };
        };

        return this.asNewStream(this.map<T[], W>(aggregator, ...args).filter(chunk => chunk.length > 0), onEnd);
    }

    async reduce<U = T>(callback: (previousValue: U, currentChunk: T) => MaybePromise<U>, initial?: U): Promise<U> {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#parameters
        //
        // initialValue (optional):
        // A value to which previousValue is initialized the first time the callback is called.
        // If initialValue is specified, that also causes currentValue to be initialized to the first
        // value in the array. If initialValue is not specified, previousValue is initialized to the first
        // value in the array, and currentValue is initialized to the second value in the array.

        const reducer = this.getReducer<U>(callback, initial);
        const reader = reducer.isAsync
            ? this.getReaderAsyncCallback(true, reducer)
            : this.getReader(true, reducer);

        return reader().then(() => reducer.value as U);
    }

    async toArray(): Promise<T[]> {
        const chunks: Array<T> = [];

        await (this.getReader(true, { onChunkCallback: chunk => { chunks.push(chunk); } }))();

        return chunks;
    }

    // TODO
    // Helper created to be used in E2E test.
    // After DataStream will be a subclass of Transform, it can be simply piped to naitve writeStream.
    async toFile(filePath: string): Promise<void> {
        const results: T[] = await this.toArray();

        await fs.writeFile(filePath, results.map(line => `${line}\n`).join(""));
    }

    _cork(): void {
        if (this.corked === null) {
            this.corked = createResolvablePromiseObject<void>();
        }
    }

    _uncork(): void {
        if (this.corked) {
            this.corked.resolver();
            this.corked = null;
        }
    }

    protected getReducer<U>(
        callback: (previousValue: U, currentChunk: T) => MaybePromise<U>,
        initial?: U
    ): Reducer<T, U> {
        const reducer: any = {
            isAsync: isAsyncFunction(callback),
            value: initial
        };

        reducer.onFirstChunkCallback = async (chunk: T): Promise<void> => {
            if (initial === undefined) {
                // Here we should probably check if typeof chunk is U.
                reducer.value = chunk as unknown as U;
            } else {
                reducer.value = await callback(reducer.value as U, chunk);
            }
        };

        if (reducer.isAsync) {
            reducer.onChunkCallback = async (chunk: T): Promise<void> => {
                reducer.value = await callback(reducer.value as U, chunk) as U;
            };
        } else {
            reducer.onChunkCallback = (chunk: T): void => {
                reducer.value = callback(reducer.value as U, chunk) as U;
            };
        }

        return reducer as Reducer<T, U>;
    }

    protected asNewStream<U, W extends DataStream<U>>(
        fromStream: W,
        onEndYield?: () => { yield: boolean, value?: U }
    ): DataStream<U> {
        return DataStream.from((async function * (stream){
            for await (const chunk of stream) {
                yield chunk;
            }

            if (onEndYield) {
                const yieldValue = onEndYield();

                if (yieldValue.yield) {
                    yield yieldValue.value as U;
                }
            }
        })(fromStream));
    }

    protected asNewFlattenedStream<U, W extends DataStream<AnyIterable<U>>>(
        fromStream: W,
        onEndYield?: () => { yield: boolean, value?: U }
    ): DataStream<U> {
        const newStream = this.create<U>();

        newStream.readSource((async function * (stream){
            for await (const chunks of stream) {
                yield* chunks;
            }

            if (onEndYield) {
                const yieldValue = onEndYield();

                if (yieldValue.yield) {
                    yield yieldValue.value as U;
                }
            }
        })(fromStream));

        return newStream;
    }

    protected getReader(
        uncork: boolean,
        callbacks: {
            onChunkCallback: (chunk: T) => void,
            onFirstChunkCallback?: Function,
            onEndCallback?: Function
        }
    ): () => Promise<void> {
        /* eslint-disable complexity */
        return async () => {
            if (uncork && this.corked) {
                this._uncork();
            }

            let chunk = this.ifca.read();

            // A bit of code duplication but we don't want to have unnecessary if inside a while loop
            // which is called for every chunk or wrap the common code inside another function due to performance.
            if (callbacks.onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk !== null) {
                    await callbacks.onFirstChunkCallback(chunk);
                    chunk = this.ifca.read();
                }
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk === null) {
                    break;
                }

                callbacks.onChunkCallback(chunk);

                chunk = this.ifca.read();
            }

            if (callbacks.onEndCallback) {
                await callbacks.onEndCallback.call(this);
            }
        };
        /* eslint-enable complexity */
    }

    // This is duplicated '.getReader()' method with the only difference that 'onChunkCallback'
    // is an async function so we have to 'await' on it for each chunk. Since it has significant effect
    // on processing time (and makes it asynchronous) I have extracted it as a separate method.
    protected getReaderAsyncCallback(
        uncork: boolean,
        callbacks: {
            onChunkCallback: (chunk: T) => MaybePromise<void>,
            onFirstChunkCallback?: Function,
            onEndCallback?: Function
        }
    ): () => Promise<void> {
        /* eslint-disable complexity */
        return async () => {
            if (uncork && this.corked) {
                this._uncork();
            }

            let chunk = this.ifca.read();

            // A bit of code duplication but we don't want to have unnecessary if inside a while loop
            // which is called for every chunk or wrap the common code inside another function due to performance.
            if (callbacks.onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk !== null) {
                    await callbacks.onFirstChunkCallback(chunk);
                    chunk = this.ifca.read();
                }
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk === null) {
                    break;
                }

                await callbacks.onChunkCallback(chunk);

                chunk = this.ifca.read();
            }

            if (callbacks.onEndCallback) {
                await callbacks.onEndCallback.call(this);
            }
        };
        /* eslint-enable complexity */
    }

    // Native node readables also implement AsyncIterable interface.
    protected readSource(iterable: Iterable<T> | AsyncIterable<T>): this {
        // We don't want to return or wait for the result of the async call,
        // it will just run in the background reading chunks as they appear.
        (async (): Promise<void> => {
            if (this.corked) {
                await this.corked.promise;
            }

            for await (const data of iterable) {
                if (this.corked) {
                    await this.corked.promise;
                }

                const drain = this.ifca.write(data);

                if (drain instanceof Promise) {
                    await drain;
                }
            }

            this.ifca.end();
        })();

        return this;
    }

    protected injectArgsToCallback<U, W extends any[]>(
        callback: TransformFunction<T, U, W>,
        args: W
    ): (chunk: T) => Promise<U> | U {
        if (isAsyncFunction(callback)) {
            return async (chunk: T): Promise<U> => {
                return await callback(chunk, ...args) as unknown as Promise<U>;
            };
        }

        return (chunk: T): U => {
            return callback(chunk, ...args) as U;
        };
    }

    protected injectArgsToCallbackAndMapResult<U, X, W extends any[]>(
        callback: TransformFunction<T, U, W>,
        resultMapper: (chunk: T, result: U) => X,
        args: W
    ): (chunk: T) => Promise<X> | X {
        if (isAsyncFunction(callback)) {
            return async (chunk: T): Promise<X> => {
                return resultMapper(chunk, await callback(chunk, ...args)) as unknown as Promise<X>;
            };
        }

        return (chunk: T): X => {
            return resultMapper(chunk, callback(chunk, ...args) as U) as X;
        };
    }
}
