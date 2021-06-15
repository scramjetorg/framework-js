import { IIFCA, TransformArray, TransformFunction } from ".";

type MaybePromise<Z> = Promise<Z> | Z;
type Waiting<Z> = ((x: Z) => void) | undefined;

const callif = <T extends (...args: Z) => void, Z extends any[]>(f: T|undefined, ...args: Z) => {
    f && f(...args);
    return !!f;
}

export class IFCA<S,T,I extends IIFCA<S,any,any>> implements IIFCA<S,T,I> {

    constructor(maxParallel: number, initialTransform: TransformFunction<S,T>) {
        this.maxParallel = maxParallel;
        this.transforms = [initialTransform];

        this.work = Array(this.maxParallel);
        this.done = Array(this.maxParallel);
        this.drain = Array(this.maxParallel);
        this.waiting = Array(this.maxParallel);
    }

    maxParallel: number;
    transforms: TransformArray<S,T>;

    private work: (Promise<any>|undefined)[];
    private done: (T|undefined)[];
    
    private drain: (Waiting<void>)[];
    private waiting: (Waiting<T|null>)[];

    // Indexes will overflow after reading 2^52 items.
    private writeIndex = 0;
    private readIndex = 0;

    private ended: boolean = false;

    get status() {
        let x = Array(this.maxParallel);

        for (let i = 0; i < x.length; i++) {
            x[i] = this.drain[i] ? "D" : this.done[i] ? "d" : this.waiting[i] ? "f" : this.work[i] ? "w" : ".";
        }

        return x.join('');
    }

    read(): MaybePromise<T|null> {
        // which item to read
        const readIndex = this.readIndex++ % this.maxParallel;
        // if this is the same item we're writing, then we're full
        return typeof this.work[readIndex] !== "undefined"
            ? (this.work[readIndex] as Promise<void>).then(() => this._read(readIndex))
            : this._read(readIndex);
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
        
        // check if two items couldn't be overwriting items on maxParallel 
        // consecutive writes
        return this.isWorking(idx)
            ? this.isDrained().then(() => this._write(idx, result))
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
        return typeof this.work[index] !== "undefined" || typeof this.done[index] !== "undefined";
    }

    private isDrained(): Promise<void> {
        const idx = (this.writeIndex + 1) % this.maxParallel;
        return this.work[idx] || (typeof this.done[idx] !== "undefined" 
            ? new Promise(res => this.drain[idx] = res)
            : Promise.resolve()
        );
    }

    private _read(idx: number): MaybePromise<T|null> {
        // this is the value, when it's already done
        let tmpvalue: T | undefined = this.done[idx];
        
        // let's mark this as read?
        // this.work[readIndex] = undefined;

        // but if it's undefined
        if (typeof tmpvalue === "undefined") {
            if (this.ended) return null;

            return (new Promise(async res => {
                // that means we need to wait for it
                if (this.work[idx]) {
                    await this.work[idx];
                    res(this.done[idx] as T);
                    this.done[idx] = undefined;
                } else if (this.ended) {
                    return res(null);
                } else {
                    this.waiting[idx] = (value) => {
                        this.waiting[idx] = undefined;
                        res(value);
                    }
                }
            }) as Promise<T|null>)
                .finally(() => {
                    callif(this.drain[idx]);
                    this.drain[idx] = undefined;
                })
        } else {
            this.done[idx] = undefined;
            callif(this.drain[idx]);
            this.drain[idx] = undefined;
            return tmpvalue;
        }
    }

    private _write(idx: number, result: Promise<T>): void {
        result.then(x => {
            this.work[idx] = undefined;
            if (typeof this.waiting[idx] === "function") {
                callif(this.waiting[idx], x);
            } else {
                this.done[idx] = x;
            }
        });

        this.work[idx] = result;

        if (this.writeIndex >= this.maxParallel)
            this.writeIndex = this.writeIndex % this.maxParallel;
    }

}