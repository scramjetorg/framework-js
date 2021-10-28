import { Readable } from "stream";
import { createReadStream, promises as fs } from "fs";
import { BaseStream } from "./base-stream";
import { IFCA } from "../ifca";
import { AnyIterable, Constructor, DroppedChunk, ResolvablePromiseObject, TransformFunction } from "../types";
import { createResolvablePromiseObject, isAsyncFunction } from "../utils";

export class DataStream<T> implements BaseStream<T>, AsyncIterable<T> {
    constructor() {
        this.ifca = new IFCA<T, T, any>(2, (chunk: T) => chunk);
        this.corked = createResolvablePromiseObject<void>();
    }

    protected ifca: IFCA<T, T, any>;
    protected corked: ResolvablePromiseObject<void> | null;

    static from<U extends any, W extends DataStream<U>>(
        this: Constructor<W>,
        input: Iterable<U> | AsyncIterable<U> | Readable
    ): W {
        return (new this()).read(input);
    }

    static fromFile<U extends any, W extends DataStream<U>>(
        this: Constructor<W>,
        path: string,
        options?: any
    ): W {
        return (new this()).read(createReadStream(path, options?.readStream));
    }

    [Symbol.asyncIterator]() {
        if (this.corked) {
            this._uncork();
        }

        return {
            next: async () => {
                const value = await this.ifca.read();

                return Promise.resolve({ value, done: value === null } as IteratorResult<T, boolean>);
            }
        };
    }

    map<U, W extends any[] = []>(callback: TransformFunction<T, U, W>, ...args: W): DataStream<U> {
        if (args?.length) {
            this.ifca.addTransform(this.injectArgsToCallback<U, typeof args>(callback, args));
        } else {
            this.ifca.addTransform(callback);
        }

        return this as unknown as DataStream<U>;
    }

    // TODO // batch/aggregate - if null/undefined skipped?
    // remap<U, W extends any[] = []>(callback: TransformFunction<T, U, W>, ...args: W): DataStream<U> {
    //     if (args?.length) {
    //         this.ifca.addTransform(this.injectArgsToCallback<U, typeof args>(callback, args));
    //     } else {
    //         this.ifca.addTransform(callback);
    //     }

    //     return this as unknown as DataStream<U>;
    // }

    async reduce<U = T>(callback: (previousValue: U, currentChunk: T) => Promise<U> | U, initial?: U): Promise<U> {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#parameters
        //
        // initialValue (optional):
        // A value to which previousValue is initialized the first time the callback is called.
        // If initialValue is specified, that also causes currentValue to be initialized to the first
        // value in the array. If initialValue is not specified, previousValue is initialized to the first
        // value in the array, and currentValue is initialized to the second value in the array.

        const values: { prev?: U } = { prev: initial };
        const initFn = async (chunk: T): Promise<void> => {
            if (initial === undefined) {
                // Here we should probably check if typeof chunk is U.
                values.prev = chunk as unknown as U;
            } else {
                values.prev = await callback(values.prev as U, chunk);
            }
        };

        if (isAsyncFunction(callback)) {
            const reducerFn = async (chunk: T): Promise<void> => {
                values.prev = await callback(values.prev as U, chunk) as U;
            };

            await (this.getReaderAsyncCallback(true, reducerFn, () => {}, initFn))();
        } else {
            const reducerFn = (chunk: T): void => {
                values.prev = callback(values.prev as U, chunk) as U;
            };

            await (this.getReader(true, reducerFn, () => {}, initFn))();
        }

        return Promise.resolve(values.prev as U);
    }

    filter<W extends any[] = []>(callback: TransformFunction<T, Boolean, W>, ...args: W): DataStream<T> {
        const chunksFilter = (chunk: T, result: Boolean) => result ? chunk : DroppedChunk;

        this.ifca.addTransform(
            this.injectArgsToCallbackAndMapResult(callback, chunksFilter, args)
        );

        return this;
    }

    flatMap<U, W extends any[] = []>(callback: TransformFunction<T, AnyIterable<U>, W>, ...args: W): DataStream<U> {
        return this.asNewFlattenedStream(this.map<AnyIterable<U>, W>(callback, ...args));
    }

    async toArray(): Promise<T[]> {
        const chunks: Array<T> = [];

        await (this.getReader(true, chunk => { chunks.push(chunk); }))();

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

    protected asNewFlattenedStream<U, W extends DataStream<AnyIterable<U>>>(
        fromStream: W,
        onEndYield?: () => { yield: boolean, value?: U }
    ): DataStream<U> {
        return DataStream.from((async function * (stream){
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
    }

    // For now this method assumes both callbacks are sync ones.
    protected getReader(
        uncork: boolean,
        onChunkCallback: (chunk: T) => void,
        onEndCallback?: Function,
        onFirstChunkCallback?: Function
    ): () => Promise<void> {
        return async () => {
            if (uncork && this.corked) {
                this._uncork();
            }

            let chunk = this.ifca.read();

            // A bit of code duplication but we don't want to have unnecessary if inside of while
            // or wrap it inside another function due to performance concerns.
            if (onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk !== null) {
                    await onFirstChunkCallback(chunk);
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

                onChunkCallback(chunk);

                chunk = this.ifca.read();
            }

            if (onEndCallback) {
                await onEndCallback.call(this);
            }
        };
    }

    protected getReaderAsyncCallback(
        uncork: boolean,
        onChunkCallback: (chunk: T) => Promise<void>,
        onEndCallback?: Function,
        onFirstChunkCallback?: Function
    ): () => Promise<void> {
        return async () => {
            if (uncork && this.corked) {
                this._uncork();
            }

            let chunk = this.ifca.read();

            // A bit of code duplication but we don't want to have unnecessary if inside a while loop
            // which is called for every chunk or wrap the common code inside another function due to performance.
            if (onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk !== null) {
                    await onFirstChunkCallback(chunk);
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

                await onChunkCallback(chunk);

                chunk = this.ifca.read();
            }

            if (onEndCallback) {
                await onEndCallback.call(this);
            }
        };
    }

    // Native node readables also implement AsyncIterable interface.
    protected read(iterable: Iterable<T> | AsyncIterable<T>): this {
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
