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
    remap<U, W extends any[] = []>(callback: TransformFunction<T, U, W>, ...args: W): DataStream<U> {
        if (args?.length) {
            this.ifca.addTransform(this.injectArgsToCallback<U, typeof args>(callback, args));
        } else {
            this.ifca.addTransform(callback);
        }

        return this as unknown as DataStream<U>;
    }

    filter<W extends any[] = []>(callback: TransformFunction<T, Boolean, W>, ...args: W): DataStream<T> {
        const chunksFilter = (chunk: T, result: Boolean) => result ? chunk : DroppedChunk;

        this.ifca.addTransform(
            this.injectArgsToCallbackAndMapResult(callback, chunksFilter, args)
        );

        return this;
    }

    flatMap<U, W extends any[] = []>(callback: TransformFunction<T, AnyIterable<U>, W>, ...args: W): DataStream<U> {
        const intermediateStream = this.map<AnyIterable<U>, W>(callback, ...args);
        const input = async function*() {
            // for await (const chunks of intermediateStream) {
            //     for await (const chunk of chunks) {
            //         yield chunk as U;
            //     }
            // }

            if (intermediateStream.corked) {
                intermediateStream._uncork();
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                let chunks = intermediateStream.ifca.read();

                if (chunks instanceof Promise) {
                    chunks = await chunks;
                }
                if (chunks === null) {
                    break;
                }

                for await (const chunk of chunks) {
                    yield chunk as U;
                }
            }
        };

        return DataStream.from(input());
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

    // For now this method assumes both callbacks are sync ones.
    protected getReader(
        uncork: boolean,
        onChunkCallback: (chunk: T) => void,
        onEndCallback?: Function
    ): () => Promise<void> {
        return async () => {
            if (uncork && this.corked) {
                this._uncork();
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                let chunk = this.ifca.read();

                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }
                if (chunk === null) {
                    if (onEndCallback) {
                        onEndCallback.call(this);
                    }
                    break;
                }

                onChunkCallback(chunk);
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
