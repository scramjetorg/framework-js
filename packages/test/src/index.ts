// import { deepStrictEqual } from "assert";

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export interface IIFCA<T,S> {
    maxParallel: number;
    transforms: TransformFunction<any,any>[];

    addChunk(chunk: T): {value: Promise<S>, drain?: Promise<void>}
    last(): Promise<S>

    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<S,W>): IIFCA<T,W>;
    removeTransform<W>(tr: TransformFunction<W,S>): IIFCA<T,W>;
}

export class IFCA<T,S> implements IIFCA<T,S> {
    constructor(maxParallel: number, transforms: TransformFunction<any,any>[]) {
        this.maxParallel = maxParallel;
    }

    maxParallel: number;
    transforms: TransformFunction<any, any>[];
    addChunk(_chunk: T): { value: Promise<S>; drain?: Promise<void> | undefined; } {
        throw new Error("Method not implemented.");
    }
    last(): Promise<S> {
        throw new Error("Method not implemented.");
    }
    addTransform<W>(_tr: TransformFunction<S, W>): IFCA<T, W> {
        throw new Error("Method not implemented.");
    }
    removeTransform<W>(_tr: TransformFunction<W, S>): IFCA<T, W> {
        throw new Error("Method not implemented.");
    }

}

// deepStrictEqual(out, [1,2,3,4]);