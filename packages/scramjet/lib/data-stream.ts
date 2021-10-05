import { Readable } from "stream";
import { createReadStream, promises as fs } from "fs";
import * as readline from "readline";
import { BaseStream, BaseStreamCreators } from "./base-stream";
import { IFCA, TransformFunction, DroppedChunk } from "../../ifca/lib/index";
import { isAsyncFunction } from "./utils";
import { createResolvablePromiseObject, ResolvablePromiseObject } from "../../ifca/utils/index";

export class DataStream<T> extends BaseStreamCreators implements BaseStream<T>, AsyncIterable<T> {
    constructor() {
        super();

        this.ifca = new IFCA<T, T, any>(2, (chunk: T) => chunk);
        this.corked = createResolvablePromiseObject<void>();
    }

    private ifca: IFCA<T, T, any>;
    private corked: ResolvablePromiseObject<void> | null;

    static from<U extends any>(input: Iterable<U> | AsyncIterable<U> | Readable): DataStream<U> {
        const dataStream = new DataStream<U>();

        dataStream.read(input);

        return dataStream;
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

    filter<W extends any[] = []>(callback: TransformFunction<T, Boolean, W>, ...args: W): DataStream<T> {
        const chunksFilter = (chunk: T, result: Boolean) => result ? chunk : DroppedChunk;

        this.ifca.addTransform(
            this.injectArgsToCallbackAndMapResult(callback, chunksFilter, args)
        );

        return this;
    }

    async toArray(): Promise<T[]> {
        if (this.corked) {
            this._uncork();
        }

        const chunks: Array<T> = [];

        let value;

        while ((value = await this.ifca.read()) !== null) {
            chunks.push(value as T);
        }

        return chunks;
    }

    // TODO
    // Helper created to be used in E2E test.
    // Reads line-by-line which should not be default behaviour.
    static fromFile(filePath: string): DataStream<string> {
        const fileStream = createReadStream(filePath);
        const lineStream = readline.createInterface({
            input: fileStream
        });

        return DataStream.from(lineStream);
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

    // Native node readables also implement AsyncIterable interface.
    private read(iterable: Iterable<T> | AsyncIterable<T>): void {
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
    }

    private injectArgsToCallback<U, W extends any[]>(
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

    private injectArgsToCallbackAndMapResult<U, X, W extends any[]>(
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
