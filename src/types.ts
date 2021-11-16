export type AnyIterable<T> = T[] | Iterable<T> | AsyncIterable<T>;

export type MaybePromise<S> = Promise<S> | S;
export type ResolvablePromiseObject<T> = {promise: Promise<T>, resolver: () => (T)};
export type ErrorWithReason = Error & { cause?: Error };

export type TransformFunction<V, U, W extends any[] = []> = (chunk: V, ...args: W) => (Promise<U>|U);
export type TransformErrorHandler<S, T> = (err: ErrorWithReason|undefined, chunk?: S) => MaybePromise<T|undefined>;
export type TransformArray<S, T> = [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    TransformFunction<any, T>,
    ...TransformFunction<any, any>[]
];
export type TransformHandler<S, T> =
    [TransformFunction<S, T>, TransformErrorHandler<S, T>?] |
    [undefined, TransformErrorHandler<S, T>];

export type IFCAOptions = { maxParallel?: number, ordered?: boolean, strict?: boolean };
export type StreamOptions = IFCAOptions & { [key: string]: any };

export type StreamConstructor<T> = { new (options?: StreamOptions): T };

export const DroppedChunk = Symbol("DroppedChunk");
