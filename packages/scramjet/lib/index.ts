import { Readable } from "stream";
import { IFCA } from "../../ifca/lib/index";

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

    // map(){}

    // filter(){}

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
