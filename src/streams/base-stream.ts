import { TransformFunction, AnyIterable, MaybePromise } from "../types";
export interface BaseStream<T extends any> {
    map<U, W extends any[]>(callback: TransformFunction<T, U, W>, ...args: W): BaseStream<U>;
    flatMap<U, W extends any[]>(callback: TransformFunction<T, AnyIterable<U>, W>, ...args: W): BaseStream<U>;
    filter<W extends any[]>(callback: TransformFunction<T, Boolean, W>, ...args: W): BaseStream<T>;
    batch<W extends any[] = []>(callback: TransformFunction<T, Boolean, W>, ...args: W): BaseStream<T[]>;
    reduce<U = T>(callback: (previousValue: U, currentChunk: T) => MaybePromise<U>, initial?: U): Promise<U>;
}
