import { Readable } from "stream";
import { DataStream } from "./data-stream";

export class StringStream<T extends string = string> extends DataStream<T> {

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
    static from<U extends string = string>(input: Iterable<U> | AsyncIterable<U> | Readable): StringStream<U> {
        const stringStream = new StringStream<U>();

        stringStream.read(input);

        return stringStream;
    }

    split(splitBy: string) {
        return this.flatMap(this.getSplitter(splitBy));
    }

    private getSplitter(splitBy: string) {
        let prevValue: T;

        return (chunk: T): T[] => {
            const endsWithSplit = chunk.endsWith(splitBy);
            const tmpChunk = prevValue.length ? prevValue + chunk : chunk;

            if (!tmpChunk.includes(splitBy)) {
                prevValue = tmpChunk as T;
                return this.ifca.hasEnded ? [prevValue] : [];
            }

            const chunks = chunk.split(splitBy) as T[];

            if (!endsWithSplit) {
                prevValue = chunks.pop() as T;
            }

            return chunks;
        };
    }
}
