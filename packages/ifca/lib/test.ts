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

    private writeIndex = -1;
    private readIndex = 0;

    private ended: boolean = false;

    async write(data: S) {
        if (this.ended) {
            throw new Error("Write after end");
        }

        const result: Promise<T> = (this.transforms as TransformFunction<any, any>[])
            .reduce(
                (prev, transform) => prev.then(transform.bind(this)), 
                Promise.resolve(data)
            ) as Promise<unknown> as Promise<T>;
        
        if (this.isFull()) await this.isDrained();

        const idx = ++this.writeIndex % this.maxParallel;

        result.then(x => {
            if (typeof this.waiting[idx] === "function") {
                this.waiting[idx](x); 
            } else {
                this.done[idx] = x;
            }
        })
        
        this.work[idx] = result;

        if (this.writeIndex >= this.maxParallel) 
            this.writeIndex = this.writeIndex % this.maxParallel;
    }

    async end(): Promise<void> {
        this.ended = true;
        await Promise.all(this.work);
        let next: Waiting<T|null>;
        while ((next = this.waiting[this.writeIndex++]) && !this.isFull()) {
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

    private isFull(): boolean {
        return this.readIndex === this.writeIndex % this.maxParallel;
    }

    private isDrained(): MaybePromise<void> {
        return this.work[(this.writeIndex + 1) % this.maxParallel];
    }

    async read(): Promise<T|null> {
        // which item to read
        const readIndex = this.readIndex++ % this.maxParallel;
        // if this is the same item we're writing, then we're full
        if (readIndex === this.writeIndex % this.maxParallel) {
            await this.isDrained();
        }
        // this is the value, when it's already done
        let value: T | null;
        let tmpvalue: T | undefined = this.done[readIndex];
        // but if it's undefined
        if (typeof tmpvalue === "undefined") {
            // that means we need to wait for it
            if (this.work[readIndex]) {
                await this.work[readIndex];
                value = this.done[readIndex] as T;
            } else if (this.ended) {
                return null;
            } else {
                value = await new Promise((res: Waiting<T|null>) => {
                    this.waiting[readIndex] = res;
                });
            }

            delete this.waiting[readIndex];
            delete this.done[readIndex];
            delete this.work[readIndex];
        } else {
            value = tmpvalue;
        }

        return value;
    }

}