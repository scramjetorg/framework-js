import { Readable } from "stream";
import { BaseStream, BaseStreamCreators } from "./base-stream";
import { IFCA, TransformFunction } from "../../ifca/lib/index";
import { isIterable, isAsyncIterable } from "./utils";
export class DataStream<T> extends BaseStreamCreators implements BaseStream<T> {
    constructor() {
        super();

        this.ifca = new IFCA<T, T, any>(2, (chunk: T) => chunk);
    }

    private ifca: IFCA<T, T, any>;
    private input: Iterable<T> | AsyncIterable<T> | Readable | null = null;

    static from<U>(input: Iterable<U> | AsyncIterable<U> | Readable): DataStream<U> {
        const dataStream = new DataStream<U>();

        dataStream.input = input;

        return dataStream;
    }

    map<U>(callback: TransformFunction<T, U>): DataStream<U> {
        this.ifca.addTransform(callback);
        return this as unknown as DataStream<U>;
    }

    // We would like to have single stream/IFCA for filtering
    // which requires supporting 1 to 0 chunk transformations in IFCA (TODO)
    filter(callback: TransformFunction<T, Boolean>): DataStream<T> {
        const filteredDataStream = new DataStream<T>();

        this.ifca.whenEnded().then(() => {
            filteredDataStream.ifca.end();
        });

        const wrappedCallback = async (chunk: T): Promise<void> => {
            let drained;
            let chunkResult = await callback(chunk);

            if (chunkResult) {
                drained = filteredDataStream.ifca.write(chunk);
            }

            return drained instanceof Promise ? drained : Promise.resolve();
        };

        this.ifca.addTransform(wrappedCallback);

        this.startReading();

        return filteredDataStream;
    }

    toArray() {
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

    private startReading() {
        if (this.input !== null) {
            const input = this.input;

            // We don't need keeping reference to the input after reading has started.
            this.input = null;

            if (input instanceof Readable) {
                this.readFromReadble(input);
            } else if (isIterable(input)) {
                this.readFromIterable(input as Iterable<T>);
            } else if (isAsyncIterable(input)){
                this.readFromAsyncIterable(input as AsyncIterable<T>);
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

    private readFromIterable(iterable: Iterable<T>): void {
        const iterator = iterable[Symbol.iterator]();
        const readItems = (): void => {
            let drain: Promise<void> | void;
            let data;

            while (drain === undefined && (data = iterator.next()).done !== true) {
                drain = this.ifca.write(data.value);
            }

            if (drain instanceof Promise) {
                drain.then(readItems);
            }

            if (data?.done) {
                this.ifca.end();
            }
        };

        readItems();
    }

    private readFromAsyncIterable(iterable: AsyncIterable<T>): void {
        const iterator = iterable[Symbol.asyncIterator]();
        const readItem = (): void => {
            iterator.next().then(data => {
                if (data.done) {
                    this.ifca.end();
                } else {
                    const drain = this.ifca.write(data.value);

                    if (drain instanceof Promise) {
                        drain.then(readItem);
                    } else {
                        readItem();
                    }
                }
            });
        };

        readItem();
    }
}
