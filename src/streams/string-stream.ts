import { DataStream } from "./data-stream";
import { AnyIterable, TransformFunction } from "../types";
import { checkTransformability } from "../decorators";

export class StringStream extends DataStream<string> {

    each<ARGS extends any[] = []>(callback: TransformFunction<string, void, ARGS>, ...args: ARGS): StringStream {
        return super.each(callback, ...args) as StringStream;
    }

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

    use<NEW_OUT>(callback: (stream: StringStream) => NEW_OUT): NEW_OUT {
        return super.use(callback as (stream: DataStream<string, string>) => NEW_OUT);
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

    @checkTransformability
    match(pattern: RegExp): StringStream {
        this.ifcaChain.create<string, string>(this.options);

        const regexpGroupsNr = pattern.source.match(/\((?!\?)/g)?.length || 0;
        const newStream = this.createChildStream();

        let onChunkCallback: (chunk: string) => Promise<void>;

        if (regexpGroupsNr === 0 || regexpGroupsNr === 1) {
            onChunkCallback = async (chunk: string) => {
                const matches = chunk.matchAll(pattern);

                for (const item of matches) {
                    await newStream.ifca.write(item[regexpGroupsNr]);
                }
            };
        } else {
            onChunkCallback = async (chunk: string) => {
                const matches = chunk.matchAll(pattern);

                for (const item of matches) {
                    for (let i = 1; i <= regexpGroupsNr; i++) {
                        await newStream.ifca.write(item[i]);
                    }
                }
            };
        }

        const callbacks = {
            onChunkCallback,
            onEndCallback: async () => {
                newStream.ifca.end();
            }
        };

        (this.getReaderAsyncCallback(false, callbacks))();

        return newStream;
    }

    protected createChildStream(): StringStream {
        this.readable = false;
        this.transformable = false;

        return new StringStream(this.options, this);
    }
}
