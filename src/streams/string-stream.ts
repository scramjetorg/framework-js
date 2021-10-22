import { Readable } from "stream";
import { DataStream } from "./data-stream";

export class StringStream extends DataStream<string> {

    // This errors with "Class static side
    // > 'typeof StringStream' incorrectly extends base class static side 'typeof DataStream'."
    //
    // Not sure how to handle this for now. Refs:
    // https://stackoverflow.com/a/51522619/646871
    // https://github.com/Microsoft/TypeScript/issues/5863
    //
    // https://stackoverflow.com/questions/60158391/typescript-override-generic-method:
    // > In TypeScript's type system an instance of a subclass should be able
    // > to do everything an instance of a superclass can.
    static from<U extends string = string>(input: Iterable<U> | AsyncIterable<U> | Readable): StringStream {
        const stringStream = new StringStream();

        stringStream.read(input);

        return stringStream;
    }

    split(splitBy: string) {
        return this.flatMap(this.getSplitter(splitBy));
    }

    private getSplitter(splitBy: string) {
        let prevValue: string;
        let isLastSplitEmpty: boolean = false;

        return (chunk: string): string[] => {
            const endsWithSplit = chunk.endsWith(splitBy);
            const tmpChunk = prevValue.length ? prevValue + chunk : chunk;

            if (!tmpChunk.includes(splitBy)) {
                prevValue = tmpChunk;
                return this.ifca.hasEnded ? [prevValue] : [];
            }

            const chunks = chunk.split(splitBy);

            if (isLastSplitEmpty && chunks[0] === "") {
                chunks.shift();
            }

            if (!endsWithSplit) {
                prevValue = chunks.pop();
                isLastSplitEmpty = false;
            } else {
                isLastSplitEmpty = true;
            }

            return chunks;
        };
    }
}
