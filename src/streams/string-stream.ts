import { DataStream } from "./data-stream";
import { AnyIterable, TransformFunction } from "../types";

export class StringStream extends DataStream<string> {

    create(): StringStream {
        return new StringStream();
    }

    end(): StringStream {
        return super.end() as StringStream;
    }

    resume(): StringStream {
        return super.resume() as StringStream;
    }

    pause(): StringStream {
        return super.pause() as StringStream;
    }

    split(splitBy: string): StringStream;
    split(splitBy: RegExp): StringStream;
    split(splitBy: string | RegExp): StringStream {
        const splitter = this.getSplitter(splitBy);
        const onEndYield = () => ({ yield: splitter.emitLastValue, value: splitter.lastValue });

        return this.asNewFlattenedStream(
            this.map<AnyIterable<string>>(splitter.fn),
            onEndYield
        ) as StringStream;
    }

    filter<W extends any[] = []>(callback: TransformFunction<string, Boolean, W>, ...args: W): StringStream {
        return super.filter(callback, ...args) as StringStream;
    }

    flatMap<W extends any[] = []>(
        callback: TransformFunction<string, AnyIterable<string>, W>,
        ...args: W
    ): StringStream {
        return super.flatMap(callback, ...args) as StringStream;
    }

    private getSplitter(splitBy: string | RegExp) {
        const result: any = {
            emitLastValue: false,
            lastValue: ""
        };
        const testFn = toString.call(splitBy) === "[object RegExp]"
            ? (chunk: string) => (splitBy as RegExp).test(chunk) : (chunk: string) => chunk.includes(splitBy as string);

        result.fn = (chunk: string): string[] => {
            const tmpChunk = `${result.lastValue}${chunk}`;

            result.emitLastValue = true;

            if (!testFn(tmpChunk)) {
                result.lastValue = tmpChunk;
                return [];
            }

            const chunks = tmpChunk.split(splitBy);

            result.lastValue = chunks.pop() as string;

            return chunks;
        };

        return result;
    }
}
