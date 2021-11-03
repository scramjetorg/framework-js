import { DataStream } from "./data-stream";
import { AnyIterable, TransformFunction } from "../types";

export class StringStream extends DataStream<string> {

    create(): StringStream {
        return new StringStream();
    }

    split(splitBy: string) {
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

    private getSplitter(splitBy: string) {
        const result: any = {
            emitLastValue: false,
            lastValue: ""
        };

        result.fn = (chunk: string): string[] => {
            const tmpChunk = `${result.lastValue}${chunk}`;

            result.emitLastValue = true;

            if (!tmpChunk.includes(splitBy)) {
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
