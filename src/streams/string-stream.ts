import { DataStream } from "./data-stream";
import { AnyIterable } from "../types";

export class StringStream extends DataStream<string> {

    split(splitBy: string) {
        const splitter = this.getSplitter(splitBy);
        const onEndYield = () => ({ yield: splitter.emitLastValue, value: splitter.lastValue });

        return this.asNewFlattenedStream<string, DataStream<AnyIterable<string>>>(
            this.map<AnyIterable<string>>(splitter.fn),
            onEndYield
        ) as StringStream;
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
