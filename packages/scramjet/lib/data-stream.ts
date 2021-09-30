import { Readable } from "stream";
import { createReadStream, promises as fs } from "fs";
import * as readline from "readline";
import { BaseStream, BaseStreamCreators } from "./base-stream";
import { IFCA, TransformFunction, DroppedChunk } from "../../ifca/lib/index";
import { isIterable, isAsyncIterable, isAsyncFunction } from "./utils";

export class DataStream<T> extends BaseStreamCreators implements BaseStream<T> {
    constructor() {
        super();

        this.ifca = new IFCA<T, T, any>(2, (chunk: T) => chunk);
    }

    private ifca: IFCA<T, T, any>;
    private input: Iterable<T> | AsyncIterable<T> | Readable | null = null;

    static from<U extends any>(input: Iterable<U> | AsyncIterable<U> | Readable): DataStream<U> {
        const dataStream = new DataStream<U>();

        dataStream.input = input;

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
        this.startReading();

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

    private startReading() {
        if (this.input !== null) {
            const input = this.input;

            // We don't need keeping reference to the input after reading has started.
            this.input = null;

            if (input instanceof Readable) {
                this.readFromReadble(input);
            } else if (isIterable(input) || isAsyncIterable(input)) {
                this.readFromIterable(input);
            } else {
                // Should we throw error here?
                throw Error("Invalid input type");
            }
        }
    }

    private readFromReadble(readable: Readable): void {
        const readChunks = (): void => {
            let drain: Promise<void> | void;
            let data;

            while (drain === undefined && (data = readable.read()) !== null) {
                drain = this.ifca.write(data);
            }

            if (drain instanceof Promise) {
                readable.pause();
                drain.then(() => {
                    readable.resume();
                });
            }
        };

        readable.on("readable", readChunks);

        readable.on("end", () => {
            this.ifca.end();
        });
    }

    private readFromIterable(iterable: Iterable<T> | AsyncIterable<T>): void {
        // We don't want to return or wait for the result of the async call,
        // it will just run in the background reading chunks as they appear.
        (async (): Promise<void> => {
            for await (const data of iterable) {
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
