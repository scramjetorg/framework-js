// import { deepStrictEqual } from "assert";

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export interface IIFCA<T,S> {
    maxParallel: number;
    transforms: TransformFunction<any,any>[];

    addChunk(chunk: T): {value: Promise<S>, drain?: Promise<void>}
    last(): Promise<S>

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
    processing: T[] = [];

    addChunk(_chunk: T): { value: Promise<S>; drain?: Promise<void> | undefined; } {

        console.log('chunk: ' + _chunk);

        let _drain: void | PromiseLike<void>;

        if (this.processing.length < this.maxParallel) {
            this.processing.push(_chunk);
            _drain = undefined;
        } else {
            // _drain = this.processing[this.processing.length - this.maxParallel]; // That's wrong!?
        }

        const value = new Promise<S>((res) => {
            console.log('promise chunk: ' + _chunk)

            const result: any = this.transforms.reduce(transform => transform.call(this, _chunk)); // Getting there....

            return res(result);
        });
        console.log('value:');
        console.log(value);

        const drain = new Promise<void>((res) => {
            res(_drain);
        })

        return { value, drain }
    }
    last(): Promise<S> {
        const value = new Promise<S>((res) => {

            const result: any = this.transforms.reduce(transform => transform.call(this, this.processing[this.processing.length - 1])); // Last item
            return res(result);
        
        });
        return value;
    }
    addTransform<W>(_tr: TransformFunction<S, W>): IFCA<T, S> {
        this.transforms.push(_tr);
        return this;
        
    }
    removeTransform<W>(_tr: TransformFunction<W, S>): IFCA<T, W> {
        throw new Error("Method not implemented.");
    }

}

// deepStrictEqual(out, [1,2,3,4]);