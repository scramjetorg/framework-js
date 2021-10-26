import { Readable } from "stream";
import { TransformFunction } from "../types";

// There is no support for static methods in interfaces (or abstract classes) in TS, see:
//
// * https://github.com/microsoft/TypeScript/issues/33892
// * https://github.com/microsoft/TypeScript/issues/34516
//
// thus the workaround with BaseStream and BaseStreamCreators used below.

export interface BaseStream<T extends any> {
    map<U, W extends any[]>(callback: TransformFunction<T, U, W>, ...args: W): BaseStream<U>;
    flatMap<U, W extends any[]>(callback: TransformFunction<T, U[], W>, ...args: W): BaseStream<U>;
    filter<W extends any[]>(callback: TransformFunction<T, Boolean, W>, ...args: W): BaseStream<T>;
}

export abstract class BaseStreamCreators {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static from<T extends any>(input: Iterable<T> | AsyncIterable<T> | Readable): BaseStream<T> {
        throw new Error("Not implemented!");
    }
}
