import { DataStream } from "./data-stream";
import { AnyIterable, TransformFunction } from "../types";
export declare class StringStream extends DataStream<string> {
    each<ARGS extends any[] = []>(callback: TransformFunction<string, void, ARGS>, ...args: ARGS): StringStream;
    map<ARGS extends any[] = []>(callback: TransformFunction<string, string, ARGS>, ...args: ARGS): StringStream;
    filter<ARGS extends any[] = []>(callback: TransformFunction<string, Boolean, ARGS>, ...args: ARGS): StringStream;
    flatMap<ARGS extends any[] = []>(callback: TransformFunction<string, AnyIterable<string>, ARGS>, ...args: ARGS): StringStream;
    use<NEW_OUT>(callback: (stream: StringStream) => NEW_OUT): NEW_OUT;
    split(splitBy: string): StringStream;
    split(splitBy: RegExp): StringStream;
    parse<OUT, ARGS extends any[] = []>(callback: TransformFunction<string, OUT, ARGS>, ...args: ARGS): DataStream<string, OUT>;
    grep(pattern: RegExp): StringStream;
    match(pattern: RegExp): StringStream;
    protected createChildStream(): StringStream;
}
