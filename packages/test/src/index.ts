// import { deepStrictEqual } from "assert";

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export interface IIFCA<T,S> {
    maxParallel: number;
    transforms: TransformFunction<any,any>[];

    addChunk(chunk: T, contd: Promise<Boolean>): Promise<{ value: Promise<S>; drain?: Promise<Boolean> | undefined; }>
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

    async addChunk(_chunk: T, contd: Promise<Boolean>): Promise<{ value: Promise<S>; drain?: Promise<Boolean> | undefined; }> {

        let _drain: Boolean | PromiseLike<Boolean>;

        console.log('this.processing.length: ' + this.processing.length);

        const processMore = await contd; // await cb 4
        console.log('processMore: ' + processMore);

        if (this.processing.length < this.maxParallel && processMore === true) {
            this.processing.push(_chunk);
            _drain = false;
        } else {
            // _drain = this.processing[this.processing.length - this.maxParallel]; // That's wrong!?

            _drain  = true;
        }

        const value = new Promise<S>((res) => {
            console.log('promise chunk: ' + _chunk)

            const result: any = this.transforms.reduce((prev, transform) => transform.call(this, prev), _chunk );

            return res(result);
        });
        console.log('value:');
        console.log(value);

        const drain = new Promise<Boolean>((res) => {
            res(_drain);
        })

        return { value, drain }
    }
    last(): Promise<S> {
        const value = new Promise<S>((res) => {

            const result: any = this.transforms.reduce((prev, transform) => transform.call(this, prev), this.processing[this.processing.length - 1]);
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