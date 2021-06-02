export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export interface IIFCA<T,S> {
    // TODO: This may need a setter if maxParallel is increased so that chunks are not waiting for drain.
    maxParallel: number;
    transforms: TransformFunction<any,any>[];

    /**
     * Write (add chunk)
     * 
     * @param chunk Chunk to be processed
     */
    write(chunk: T): { value: PromiseLike<S>; drain?: PromiseLike<void> | undefined; }

    read(items: number): PromiseLike<S>[];
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

    write(_chunk: T): { value: Promise<S>; drain?: PromiseLike<void>; } {
        const drain: undefined | PromiseLike<any> = this.processing.length < this.maxParallel ? undefined : this.processing[this.processing.length - this.maxParallel]

        const value = new Promise<S>(async (res) => {
            await drain;

            const result: Promise<any> = this.transforms.reduce((prev, transform) => prev.then(transform.bind(this)), Promise.resolve(_chunk));

            return res(result as Promise<S>);
        });

        this.processing.push(value);

        return { value, drain }
    }

    read(items: number): PromiseLike<S>[] {
        return this.processing.splice(0, items);
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