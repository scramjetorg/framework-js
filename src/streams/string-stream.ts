import { DataStream } from "./data-stream";
import { AnyIterable, TransformFunction } from "../types";
import { checkTransformability } from "../decorators";

export class StringStream extends DataStream<string> {

    map<ARGS extends any[] = []>(callback: TransformFunction<string, string, ARGS>, ...args: ARGS): StringStream {
        return super.map(callback, ...args) as StringStream;
    }

    filter<ARGS extends any[] = []>(callback: TransformFunction<string, Boolean, ARGS>, ...args: ARGS): StringStream {
        return super.filter(callback, ...args) as StringStream;
    }

    flatMap<ARGS extends any[] = []>(
        callback: TransformFunction<string, AnyIterable<string>, ARGS>,
        ...args: ARGS
    ): StringStream {
        return super.flatMap(callback, ...args) as StringStream;
    }

    split(splitBy: string): StringStream;
    split(splitBy: RegExp): StringStream;

    @checkTransformability
    split(splitBy: string | RegExp): StringStream {
        const result: any = {
            emitLastValue: false,
            lastValue: ""
        };
        const testFn = toString.call(splitBy) === "[object RegExp]"
            ? (chunk: string) => (splitBy as RegExp).test(chunk) : (chunk: string) => chunk.includes(splitBy as string);

        this.ifcaChain.create<string, string>(this.options);

        const newStream = this.createChildStream();
        const callbacks = {
            onChunkCallback: async (chunk: string) => {
                const tmpChunk = `${result.lastValue}${chunk}`;

                result.emitLastValue = true;

                if (testFn(tmpChunk)) {
                    const chunks = tmpChunk.split(splitBy);

                    result.lastValue = chunks.pop() as string;

                    for (const item of chunks) {
                        await newStream.ifca.write(item);
                    }
                } else {
                    result.lastValue = tmpChunk;
                }
            },
            onEndCallback: async () => {
                if (result.emitLastValue) {
                    await newStream.ifca.write(result.lastValue);
                }

                newStream.ifca.end();
            }
        };

        (this.getReaderAsyncCallback(false, callbacks))();

        return newStream;
    }

    parse<OUT, ARGS extends any[] = []>(
        callback: TransformFunction<string, OUT, ARGS>,
        ...args: ARGS
    ): DataStream<string, OUT> {
        return super.map(callback, ...args);
    }

    grep(pattern: RegExp): StringStream {
        return this.filter(chunk => pattern.test(chunk));
    }

    protected createChildStream(): StringStream {
        this.readable = false;
        this.transformable = false;

        return new StringStream(this.options, this);
    }
}
