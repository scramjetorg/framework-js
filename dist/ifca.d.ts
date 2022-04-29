import { MaybePromise, TransformFunction, TransformErrorHandler, TransformHandler, IFCAOptions } from "./types";
export interface IIFCA<S, T, I extends IIFCA<S, any, any>> {
    transformHandlers: TransformHandler<S, T>[];
    write(chunk: S): MaybePromise<void>;
    end(): MaybePromise<void | null>;
    read(): MaybePromise<T | null>;
    addTransform<W>(tr: TransformFunction<T, W>, err?: TransformErrorHandler<T, W>): IIFCA<S, W, this>;
    removeTransform(): I;
}
export declare class IFCA<S, T = S, I extends IFCA<S, any, any> = IFCA<S, any, any>> implements IIFCA<S, T, I> {
    constructor(options: IFCAOptions);
    private id;
    private maxParallel;
    private strict;
    private ordered;
    transformHandlers: TransformHandler<S, T>[];
    private processingQueue;
    private ended;
    private drain;
    get state(): {
        id: string;
        all: number;
        pending: number;
        maxParallel: number;
        strict: boolean;
        ordered: boolean;
    };
    write(_chunk: S | null): MaybePromise<void>;
    writev(_chunks: (S | null)[]): MaybePromise<void>;
    private makeTransformChain;
    private makeStrictTransformChain;
    private mergeTransformChains;
    private makeProcessingItem;
    private attachErrorHandlerToChunkResult;
    private chainSynchronousTransforms;
    private chainAsynchronousTransforms;
    private getDrainResolver;
    end(): MaybePromise<void>;
    read(): MaybePromise<T | null>;
    addErrorHandler(handler: TransformErrorHandler<S, T>): this;
    addTransform<W, Args extends any[] = []>(transform: TransformFunction<T, W, Args>, handler?: TransformErrorHandler<T, W>): IFCA<S, W, this>;
    removeTransform(): I;
}
