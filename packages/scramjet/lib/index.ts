import { Readable } from "stream";
import { BaseStream, BaseStreamCreators } from "./basestream";
import { IFCA, TransformFunction } from "../../ifca/lib/index";

export class DataStream<T> extends BaseStreamCreators implements BaseStream<T> {
    constructor() {
        super();

        this.ifca = new IFCA<T, T, any>(2, (chunk: T) => chunk);
    }

    private ifca: IFCA<T, T, any>;
    private hasReadingStarted: Boolean = false;
    private readable: Readable | null = null;

    static from<U>(input: Iterable<U> | AsyncIterable<U> | Readable): DataStream<U> {
        const dataStream = new DataStream<U>();

        if (input instanceof Readable) {
            dataStream.fromReadable(input);
        } else {
            dataStream.fromIterable(input);
        }

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

    private fromIterable(iterable: Iterable<T> | AsyncIterable<T>): void {
        this.fromReadable(Readable.from(iterable));
    }

    private fromReadable(readable: Readable): void {
        this.readable = readable;
    }

    private startReading() {
        if (!this.hasReadingStarted && this.readable !== null) {
            let drain: Promise<void> | void;

            const readable = this.readable;
            const readChunk = () => {
                let data;

                while (drain === undefined && (data = readable.read()) !== null) {
                    drain = this.ifca.write(data);

                    if (drain instanceof Promise) {
                        readable.pause();
                        // eslint-disable-next-line no-loop-func
                        drain.then(() => {
                            drain = undefined;
                            readable.resume();
                        });
                    }
                }
            };

            this.readable.on("readable", readChunk);

            this.readable.on("end", () => {
                this.ifca.write(null);
            });
        }

        this.hasReadingStarted = true;
    }
}
