export declare type AnyIterable<T> = T[] | Iterable<T> | AsyncIterable<T>;
export declare type MaybePromise<S> = Promise<S> | S;
export declare type ResolvablePromiseObject<T> = {
    promise: Promise<T>;
    resolver: () => (T);
};
export declare type ErrorWithReason = Error & {
    cause?: Error;
};
export declare type TransformFunction<V, U, W extends any[] = []> = (chunk: V, ...args: W) => (Promise<U> | U);
export declare type TransformErrorHandler<S, T> = (err: ErrorWithReason | undefined, chunk?: S) => MaybePromise<T | undefined>;
export declare type TransformArray<S, T> = [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    TransformFunction<any, T>,
    ...TransformFunction<any, any>[]
];
export declare type TransformHandler<S, T> = [
    TransformFunction<S, T>,
    TransformErrorHandler<S, T>?
] | [
    undefined,
    TransformErrorHandler<S, T>
];
export declare type IFCAOptions = {
    maxParallel?: number;
    ordered?: boolean;
    strict?: boolean;
};
export declare type StreamOptions = IFCAOptions & {
    [key: string]: any;
};
export declare type StreamConstructor<T> = {
    new (options?: StreamOptions): T;
};
export declare const DroppedChunk: unique symbol;
