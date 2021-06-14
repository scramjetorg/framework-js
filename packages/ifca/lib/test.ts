import { IIFCA, TransformArray, TransformFunction } from ".";

type MaybePromise<Z> = Promise<Z> | Z;
type Waiting<Z> = (x: Z) => void;

export class IFCA<S,T,I extends IIFCA<S,any,any>> implements IIFCA<S,T,I> {

    constructor(maxParallel: number, initialTransform: TransformFunction<S,T>) {
        this.maxParallel = maxParallel;
        this.transforms = [initialTransform];
        this.work = Array(this.maxParallel);
        this.done = Array(this.maxParallel);
        this.waiting = Array(this.maxParallel);
    }

    maxParallel: number;
    transforms: TransformArray<S,T>;

    private work: (Promise<any>|undefined)[];
    private done: (T|undefined)[];
    private waiting: Waiting<T|null>[];

    private writeIndex = 0;
    private readIndex = 0;

    private ended: boolean = false;

    get status() {
        let x = Array(this.maxParallel);

        for (let i = 0; i < x.length; i++) {
            x[i] = this.done[i] ? "d" : this.waiting[i] ? "f" : this.work[i] ? "w" : ".";
        }

        return x.join('');
    }

    read(): MaybePromise<T|null> {
        // which item to read
        const readIndex = this.readIndex++ % this.maxParallel;
        // if this is the same item we're writing, then we're full
        if (this.isWorking(readIndex)) {
            return this.isDrained().then(() => this._read(readIndex))
        }

        return this._read(readIndex);
    }

    write(data: S): MaybePromise<void> {
        if (this.ended) {
            throw new Error("Write after end");
        }

        const idx = this.writeIndex++ % this.maxParallel;
        const result: Promise<T> = (this.transforms as TransformFunction<any, any>[])
            .reduce(
                (prev, transform) => prev.then(transform.bind(this)), 
                Promise.resolve(data)
            ) as Promise<unknown> as Promise<T>;
        
        return this.isWorking(idx)
            ?  this.isDrained().then(() => this._write(idx, result))
            : this._write(idx, result);
    }

    async end(): Promise<void> {
        this.ended = true;
        await Promise.all(this.work);
        let next: Waiting<T|null>;
        while ((next = this.waiting[this.writeIndex++]) && !this.isWorking()) {
            next(null);
        }
    }

    addTransform<W>(_tr: TransformFunction<T, W>): IFCA<S, W, this> {
        (this.transforms as TransformFunction<any, any>[]).push(_tr);
        return this as unknown as IFCA<S,W,this>;
    }

    removeTransform() {
        this.transforms.pop();
        return this as unknown as I;
    }

    private isWorking(index = this.readIndex): boolean {
        return typeof this.work[index] !== "undefined";
    }

    private isDrained(): Promise<void> {
        return Promise.resolve(this.work[(this.writeIndex + 1) % this.maxParallel]);
    }

    private _read(idx: number): MaybePromise<T|null> {
        console.log("read ", {idx, twi: this.writeIndex, tri: this.readIndex})

        // this is the value, when it's already done
        let tmpvalue: T | undefined = this.done[idx];
        
        // let's mark this as read?
        // delete this.work[readIndex];

        // but if it's undefined
        if (typeof tmpvalue === "undefined") {
            if (this.ended) return null;
            return new Promise(async res => {
                // that means we need to wait for it
                if (this.work[idx]) {
                    await this.work[idx];
                    res(this.done[idx] as T);
                    delete this.done[idx];
                } else if (this.ended) {
                    return res(null);
                } else {
                    console.log("waiting", idx);
                    this.waiting[idx] = (value) => {
                        console.log("resolve", idx, value);
                        delete this.waiting[idx];
                        res(value);
                    }
                }
            })
        } else {
            delete this.done[idx];
            return tmpvalue;
        }
    }

    private _write(idx: number, result: Promise<T>): void {
        console.log("write", {idx, twi: this.writeIndex, tri: this.readIndex})

        result.then(x => {
            console.log("wrote", idx, x);
            delete this.work[idx];
            if (typeof this.waiting[idx] === "function") {
                this.waiting[idx](x);
            } else {
                this.done[idx] = x;
            }
        });

        this.work[idx] = result;

        if (this.writeIndex >= this.maxParallel)
            this.writeIndex = this.writeIndex % this.maxParallel;
    }


}