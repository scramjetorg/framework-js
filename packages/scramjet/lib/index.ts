import { Readable } from "stream";
import { BaseStream } from './basestream';
import { IFCA, TransformFunction } from "../../ifca/lib/index";


export class DataStream<T> implements BaseStream<T> {
    constructor() {
        this.ifca = new IFCA<T,any,any>(2, (chunk: T) => chunk);
    }

    private ifca: IFCA<T,any,any>;
    private isReading: Boolean = false;
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

    map<U>(callback: TransformFunction<T,U>): DataStream<U> {
        this.ifca.addTransform(callback);
        return this as unknown as DataStream<U>; // this looks fishy, probably we should create new DataStream instance
    }

    // we would like to have single stream/IFCA which requires supporting 1 to 0 chunk transformations in IFCA (TBD)
    filter(callback: TransformFunction<T,Boolean>): DataStream<T> {
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

        this.startReading(); // this means any transfromation duplicating the stream (even interanlly) would need to be described as "output" transformation

        return filteredDataStream;
    }

    toArray() {
        this.startReading();

        return new Promise( (res) => {
            const chunks: Array<T> = [];

            const readChunk = () => {
                const chunk = this.ifca.read();
                if (chunk === null) {
                    res(chunks);
                }
                else if (chunk instanceof Promise) {
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
            }

            readChunk();
        });
    }

    private fromIterable(iterable: Iterable<T> | AsyncIterable<T>): void {
        this.fromReadable(Readable.from(iterable));
    };

    private fromReadable(readable: Readable): void {
        this.readable = readable;
    };

    private startReading() {
        if(!this.isReading && this.readable !== null) {
            let drain: Promise<void> | void = undefined;
            const readable = this.readable;

            const readChunk = () => {
                let data;
                while (drain === undefined && (data = readable.read()) !== null) {
                    drain = this.ifca.write(data);

                    if (drain instanceof Promise) {
                        readable.pause();
                        drain.then(() => {
                            drain = undefined;
                            readable.resume();
                        });
                    }
                }
            };

            this.readable.on('readable', readChunk);

            this.readable.on('end', () => {
                this.ifca.write(null);
            });
        }

        this.isReading = true;
    }
}
