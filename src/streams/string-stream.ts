// import { Readable } from "stream";
import { DataStream } from "./data-stream";

export class StringStream extends DataStream<string> {

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
