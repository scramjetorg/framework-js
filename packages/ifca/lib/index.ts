import * as util from 'util';

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

    read(items: number): PromiseLike<S>[] | Promise<void>
    last(): PromiseLike<S>

    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<S,W>): IIFCA<T,S>;
    removeTransform<W>(tr: TransformFunction<W,S>): IIFCA<T,W>;
}

export class IFCA<T,S> implements IIFCA<T,S> {
    constructor(maxParallel: number) {
        this.maxParallel = maxParallel;
    }

    isPending(promise: PromiseLike<S>) {
        return util.inspect(promise).indexOf("<pending>") > -1;
    }
    

    maxParallel: number;
    transforms: TransformFunction<any, any>[] = [];
    private processing: PromiseLike<S>[] = [];
    private results:  PromiseLike<S>[] = [];
    private waiting?: () => void;

    write(_chunk: T): { value: Promise<S>; drain?: PromiseLike<void>; } {
        const drain: undefined | PromiseLike<any> = this.processing.length < this.maxParallel ? undefined : this.processing[this.processing.length - this.maxParallel];
        const last: undefined | PromiseLike<any> = this.processing[this.processing.length - 1];

        const value = new Promise<S>(async (res) => {
            await last;

            const result: Promise<any> = this.transforms.reduce((prev, transform) => prev.then(transform.bind(this)), Promise.resolve(_chunk));

            result.then(() => this.processing.shift())
            result.then(res);
        });

        this.processing.push(value);
        this.results.push(value);
        if (this.waiting) { 
            this.waiting();
            this.waiting = undefined;
        }

        return { value, drain }
    }
    last(): PromiseLike<S> { 
            return this.processing[this.processing.length - 1];        
    
    }

    // 
    read(items: number): PromiseLike<S>[] | Promise<void> {
        // let count = 0;
        // let len = this.processing.length; // TODO: This is for debugging. Remove later.
        // for (let i = 0; i < items; i++ ) {
        //    if (this.isPending(this.processing[i])) break;
        //    count = i;
        // }
        // const result =  this.processing.splice(0, count) as unknown as S;
        // console.log('count: ' + count + ' result: ' + JSON.stringify(result) + ' queue: ' + this.processing.length + ' original len: ' + len)
        // return result;
        if (this.processing.length) return this.processing.splice(0, items);
        return new Promise(res => {
            this.waiting = res;
        })
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