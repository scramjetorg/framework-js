// import { Readable } from "stream";
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
    // static from<U extends string = string>(input: Iterable<U> | AsyncIterable<U> | Readable): StringStream {
    //     const stringStream = new StringStream();

    //     stringStream.read(input);

    //     return stringStream;
    // }

    split(splitBy: string) {
        const splitter = this.getSplitter(splitBy);
        const intermediateStream = this
            .map<Array<string>>(splitter.fn)
            .filter(chunk => chunk.length > 0) as unknown as StringStream;
        const input = async function*() {
            if (intermediateStream.corked) {
                intermediateStream._uncork();
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                let chunks = intermediateStream.ifca.read();

                if (chunks instanceof Promise) {
                    chunks = await chunks;
                }
                if (chunks === null) {
                    if (splitter.emitLastValue) {
                        yield splitter.lastValue as string;
                    }
                    break;
                }

                for (const chunk of chunks) {
                    yield chunk as string;
                }
            }
        };

        return StringStream.from(input());
    }


    private getSplitter(splitBy: string) {
        const result: any = {
            emitLastValue: false,
            lastValue: ""
        };

        let prevValue: string = "";

        const splitter = (chunk: string): string[] => {
            const tmpChunk = prevValue.length ? prevValue + chunk : chunk;
            const startsWithSplit = tmpChunk.startsWith(splitBy);
            const endsWithSplit = tmpChunk.endsWith(splitBy);

            if (!tmpChunk.includes(splitBy)) {
                prevValue = tmpChunk;
                result.lastValue = prevValue;
                result.emitLastValue = true;
                return [];
            }

            const chunks = tmpChunk.split(splitBy);

            if (endsWithSplit) {
                chunks.pop();
                result.emitLastValue = true;
                prevValue = "";
            } else {
                prevValue = chunks.length ? chunks.pop() as string : "";
                result.emitLastValue = startsWithSplit;
            }

            result.lastValue = prevValue;

            return chunks;
        };

        result.fn = splitter;

        return result;
    }
}
