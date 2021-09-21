import { Readable } from "stream";
import { TransformFunction } from "../../ifca/lib/index";

// There is no support for static methods in interfaces (or abstract classes) in TS, see:
//
// * https://github.com/microsoft/TypeScript/issues/33892
// * https://github.com/microsoft/TypeScript/issues/34516
//
// thus the workaround with BaseStream and BaseStreamCreators used below.

export interface BaseStream<T> {
    map<U>(callback: TransformFunction<T, U>): BaseStream<U>;
    filter(callback: TransformFunction<T, Boolean>): BaseStream<T>;
}

export abstract class BaseStreamCreators {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static from<T>(input: Iterable<T> | AsyncIterable<T> | Readable): BaseStream<T> {
        throw new Error("Not implemented!");
    }
}
