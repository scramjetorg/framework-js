import { SSL_OP_COOKIE_EXCHANGE } from "constants";

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
     write(chunk: T): { value: Promise<S>; drain?: PromiseLike<void> | undefined; }

    read(items: number): S[] | null;
    last(): PromiseLike<S>

    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<S,W>): IIFCA<T,S>;
    removeTransform(): IIFCA<T,S>;
}

export class IFCA<T,S> implements IIFCA<T,S> {
    // static processing: PromiseLike<S>[] = [];
    constructor(maxParallel: number) {
        this.maxParallel = maxParallel;
    }

    maxParallel: number;
    transforms: TransformFunction<any, any>[] = [];
    processing: PromiseLike<S>[] = [];
    
    readable: S[] = [];

    write(_chunk: T): { value: Promise<S>; drain?: PromiseLike<void> | undefined; } {
        console.log('');
        console.log('WRITE.....');
        this.readable.push();
        const drain: undefined | PromiseLike<any> = this.processing.length < this.maxParallel ? undefined : this.processing[this.processing.length - this.maxParallel]

        const value = new Promise<S>(async (res) => {
            await drain;

            const result: Promise<any> = this.transforms.reduce((prev, transform) => prev.then(transform.bind(this)), Promise.resolve(_chunk));

            return res(result as Promise<S>);
        });

        console.log('ADD TO PROCESSING... chunk: ' + JSON.stringify(_chunk))
        this.processing.push(value);
        console.log('write pre then... this.processing.length: ' + this.processing.length);


        const idx = this.processing.length - 1;
        value.then(async (res) => {
            console.log('');
            console.log('INDEX:' + idx + ' VALUE READY chunk: ' + JSON.stringify(_chunk) + ' value: ' + JSON.stringify(res));
            if (drain) await drain;
            // this.processing.shift();
            // this.readable[this.index] = res;
            this.readable[idx] = res;

        });

        // function generator(_index: number):Function {
        //    return function (resolve: Function) {
        //         if (drain) await drain;
        //         IFCA.processing.shift();
        //         this.readable[_index] = resolve;
        //     })
        //    };
        // };

        // value.then(generator(this.index));
        return { value }
    }

    read(items: number):S[] | null {
        console.log('READ: this.processing.length ' + this.processing.length + ' this.readable.length ' + this.readable.length);
        console.log('READ readable: ' + JSON.stringify(this.readable))
        if (this.processing.length === 0) {
            // NOTHING TO READ - TERMINATE AND RETURN NULL
            return null;
        }
        
        const result:S[] = [];
        let i = 0;
        for (i; i < items; i++) {
            if (this.readable[i]) {
                result.push(this.readable[i])
            } else {
                break;
            }
        }
        this.processing.splice(0, i);
        console.log('POST READ: this.processing.length ' + this.processing.length + ' this.readable.length ' + this.readable.length);
        console.log('POST readable: ' +JSON.stringify(this.readable))


        return result;
    }

    last(): PromiseLike<S> { 
            return this.processing[this.processing.length - 1];        
    
    }
    addTransform<W>(_tr: TransformFunction<S, W>): IFCA<T, S> {
        this.transforms.push(_tr);
        return this;
        
    }
    // Remove transform (pop)
    removeTransform(): IFCA<T, S> {
        this.transforms.pop();
        return this;
    }

}