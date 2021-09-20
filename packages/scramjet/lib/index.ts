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

    // into(){}

    private fromIterable(iterable: Iterable<T> | AsyncIterable<T>): void {
        this.fromReadable(Readable.from(iterable));
    };

    private fromReadable(readable: Readable): void {
        let drain: Promise<void> | void = undefined;

        const readChunk = () => {
            console.log('readable');

            let data;
            while (drain === undefined && (data = readable.read())) {
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
    };
}
