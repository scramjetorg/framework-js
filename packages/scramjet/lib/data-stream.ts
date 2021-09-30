import { Readable } from "stream";
import { createReadStream, promises as fs } from "fs";
import * as readline from "readline";
import { BaseStream, BaseStreamCreators } from "./base-stream";
import { IFCA, TransformFunction, DroppedChunk } from "../../ifca/lib/index";
import { isAsyncFunction } from "./utils";
import { createResolvablePromiseObject, ResolvablePromiseObject } from "../../ifca/utils/index";

export class DataStream<T> extends BaseStreamCreators implements BaseStream<T> {
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

    map<U>(callback: TransformFunction<T, U>, ...args: any[]): DataStream<U> {
        this.ifca.addTransform(this.wrapCallback<U, any>(callback, args));
        return this as unknown as DataStream<U>;
    }

    filter(callback: TransformFunction<T, Boolean>, ...args: any[]): DataStream<T> {
        const mapFilteredChunks = (chunk: T, result: Boolean) => result ? chunk : DroppedChunk;

        this.ifca.addTransform(
            this.wrapCallbackMap<Boolean, T | typeof DroppedChunk, any>(callback, mapFilteredChunks, args)
        );

        return this;
    }

    toArray(): Promise<T[]> {
        this._uncork();

        return new Promise((res) => {
            const chunks: Array<T> = [];
            const readChunk = () => {
                const chunk = this.ifca.read();

                if (chunk === null) {
                    res(chunks);
                } else if (chunk instanceof Promise) {
                    chunk.then(value => {
                        if (value === null) {
                            res(chunks);
                        } else {
                            chunks.push(value);
                            readChunk();
                        }
                    });
                } else {
                    chunks.push(chunk);
                    readChunk();
                }
            };

            readChunk();
        });
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

        await fs.writeFile(filePath, results.map(line => `${line}\n`).join(''));
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

    private wrapCallback<U, W>(
        callback: TransformFunction<T, U>,
        args: W[]
    ): (chunk: T) => Promise<U> | U {

        const isCallbackAsync = isAsyncFunction(callback);

        if (isCallbackAsync) {
            return async (chunk: T): Promise<U> => {
                return await callback(chunk, ...args) as unknown as Promise<U>;
            };
        }

        return (chunk: T): U => {
            return callback(chunk, ...args) as U;
        };
    }

    private wrapCallbackMap<U, X, W>(
        callback: TransformFunction<T, U>,
        mapFn: (chunk: T, result: U) => X,
        args: W[]
    ): (chunk: T) => Promise<X> | X {

        const isCallbackAsync = isAsyncFunction(callback);

        if (isCallbackAsync) {
            return async (chunk: T): Promise<X> => {
                return mapFn(chunk, await callback(chunk, ...args)) as unknown as Promise<X>;
            };
        }

        return (chunk: T): X => {
            return mapFn(chunk, callback(chunk, ...args) as U) as X;
        };
    }
}
