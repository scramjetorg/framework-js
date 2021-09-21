import { Readable } from "stream";
import { TransformFunction } from "../../ifca/lib/index";

// There is no support for static methods in interfaces in TS, see:
//
// * https://github.com/microsoft/TypeScript/issues/33892
// * https://github.com/microsoft/TypeScript/issues/34516
//
// thus the workaround with BaseStreamCreator used below.

class BaseStreamCreator {
    static from<U>(input: Iterable<U> | AsyncIterable<U> | Readable): BaseStream<U> {
        throw new Error('Not implemented!');
    };
}

export interface BaseStream<T> extends BaseStreamCreator {
    map<U>(callback: TransformFunction<T,U>): BaseStream<U>;
    filter(callback: TransformFunction<T,Boolean>): BaseStream<T>;
}
