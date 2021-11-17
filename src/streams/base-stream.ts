import { TransformFunction, AnyIterable, MaybePromise } from "../types";

export interface BaseStream<IN extends any, OUT extends any = IN> {
    write(value: IN): boolean;
    read(): OUT | null;
    end(): BaseStream<IN, OUT>;
    resume(): BaseStream<IN, OUT>;
    pause(): BaseStream<IN, OUT>;

    map<U, W extends any[]>(callback: TransformFunction<IN, U, W>, ...args: W): BaseStream<IN, U>;
    flatMap<U, W extends any[]>(callback: TransformFunction<IN, AnyIterable<U>, W>, ...args: W): BaseStream<IN, U>;
    filter<W extends any[]>(callback: TransformFunction<IN, Boolean, W>, ...args: W): BaseStream<IN, OUT>;
    // batch<W extends any[] = []>(callback: TransformFunction<IN, Boolean, W>, ...args: W): BaseStream<IN[]>;
    reduce<U = IN>(callback: (previousValue: U, currentChunk: IN) => MaybePromise<U>, initial?: U): Promise<U>;
}
