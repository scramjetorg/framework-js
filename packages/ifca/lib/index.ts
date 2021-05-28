export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export interface IIFCA<T,S> {
    // TODO: This may need a setter if maxParallel is increased so that chunks are not waiting for drain.
    maxParallel: number;
    transforms: TransformFunction<any,any>[];

    addChunk(chunk: T, contd: PromiseLike<Boolean>): { value: PromiseLike<S>; drain?: PromiseLike<void> | undefined; }
    last(): PromiseLike<S>

    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<S,W>): IIFCA<T,S>;
    removeTransform<W>(tr: TransformFunction<W,S>): IIFCA<T,W>;
}

export class IFCA<T,S> implements IIFCA<T,S> {
    constructor(maxParallel: number) {
        this.maxParallel = maxParallel;
    }

    maxParallel: number;
    transforms: TransformFunction<any, any>[] = [];
    private processing: PromiseLike<S>[] = [];

    addChunk(_chunk: T): { value: Promise<S>; drain?: PromiseLike<void>; } {
        const drain: undefined | PromiseLike<any> = this.processing.length < this.maxParallel ? undefined : this.processing[this.processing.length - this.maxParallel]

        const value = new Promise<S>(async (res) => {
            await drain;

            const result: Promise<any> = this.transforms.reduce((prev, transform) => prev.then(transform.bind(this)), Promise.resolve(_chunk));

            return res(result as Promise<S>);
        });

        this.processing.push(value);

        return { value, drain }
    }
    last(): PromiseLike<S> { 
            return this.processing[this.processing.length - 1];        
    
    }
    addTransform<W>(_tr: TransformFunction<S, W>): IFCA<T, S> {
        this.transforms.push(_tr);
        return this;
        
    }
    // Remove transform (pop)
    removeTransform<W>(_tr: TransformFunction<W, S>): IFCA<T, W> {
        throw new Error("Method not implemented.");
    }

}