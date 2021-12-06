import { Writable } from "stream";
import { TransformFunction, AnyIterable, MaybePromise } from "../types";

export interface BaseStream<IN extends any, OUT extends any> {
    write(chunk: IN): MaybePromise<void>;
    read(): MaybePromise<OUT|null>;
    pause(): void;
    resume(): void;
    end(): MaybePromise<void>;

    each<ARGS extends any[]>(callback: TransformFunction<OUT, void, ARGS>, ...args: ARGS): BaseStream<IN, OUT>;
    map<ARGS extends any[]>(
        callback: TransformFunction<OUT, OUT, ARGS>, ...args: ARGS): BaseStream<IN, OUT>;
    map<NEW_OUT, ARGS extends any[]>(
        callback: TransformFunction<OUT, NEW_OUT, ARGS>, ...args: ARGS): BaseStream<IN, NEW_OUT>;
    filter<ARGS extends any[]>(callback: TransformFunction<OUT, Boolean, ARGS>, ...args: ARGS): BaseStream<IN, OUT>;
    batch<ARGS extends any[]>(callback: TransformFunction<OUT, Boolean, ARGS>, ...args: ARGS): BaseStream<IN, OUT[]>;
    flatMap<ARGS extends any[]>(
        callback: TransformFunction<OUT, AnyIterable<OUT>, ARGS>, ...args: ARGS): BaseStream<IN, OUT>;
    flatMap<NEW_OUT, ARGS extends any[]>(
        callback: TransformFunction<OUT, AnyIterable<NEW_OUT>, ARGS>, ...args: ARGS): BaseStream<IN, NEW_OUT>;
    pipe<DEST extends BaseStream<OUT, any>>(destination: DEST, options: { end: boolean }): DEST;
    pipe<DEST extends Writable>(destination: DEST, options: { end: boolean }): DEST;
    use<NEW_OUT>(callback: (stream: BaseStream<IN, OUT>) => NEW_OUT): NEW_OUT;
    reduce<NEW_OUT>(
        callback: (previous: NEW_OUT, current: OUT) => MaybePromise<NEW_OUT>, initial?: NEW_OUT): Promise<NEW_OUT>;
    toArray(): Promise<OUT[]>;
    run(): Promise<void>;
}
