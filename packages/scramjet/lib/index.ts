import { Readable } from "stream";
import { IFCA, TransformFunction } from "../../ifca/lib/index";

export class DataStream<T> {
    constructor() {
        this.ifca = new IFCA<T,any,any>(2, (chunk: T) => chunk);
    }

    private ifca: IFCA<T,any,any>;

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

        return filteredDataStream;
    }

    toArray() {
        return new Promise( (res) => {
            const chunks: Array<T> = [];

            const readChunk = () => {
                const chunk = this.ifca.read();
                console.log('--- read chunk', chunk);
                if (chunk === null) {
                    res(chunks);
                }
                else if (chunk instanceof Promise) {
                    chunk.then(value => {
                        console.log('--- chunk resolved', value);
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
        let drain: Promise<void> | void = undefined;

        const readChunk = () => {
            console.log('readable');

            let data;
            while (drain === undefined && (data = readable.read()) !== null) {
                console.log('data', data);
                drain = this.ifca.write(data);
                console.log('drain', drain);

                if (drain instanceof Promise) {
                    console.log('waiting');
                    readable.pause();
                    drain.then(() => {
                        console.log('read');
                        drain = undefined;
                        readable.resume();
                    });
                }

                console.log('--- loop');
            }
        };

        readable.on('readable', readChunk);

        readable.on('end', () => {
            this.ifca.write(null);
        });
    };
}
