import { IIFCA, TransformFunction } from ".";

type MaybePromise<Z> = Promise<Z> | Z;
type Waiting<Z> = (x: Z) => void;

export class IFCA<T,S> implements IIFCA<T,S> {
    constructor(maxParallel: number) {
        this.maxParallel = maxParallel;
    }

    maxParallel: number;
    transforms: TransformFunction<any, any>[] = [];

    MAX = 16;
    work: (Promise<any>|undefined)[] = Array(this.MAX);
    done: (S|undefined)[] = Array(this.MAX);
    waiting: Waiting<S>[] = Array(this.MAX);

    writeIndex = -1;
    readIndex = 0;

    async write(data: T) {
        const result: Promise<S> = this.transforms
            .reduce(
                (prev, transform) => prev.then(transform.bind(this)), 
                Promise.resolve(data)
            ) as Promise<unknown> as Promise<S>;
        
        if (this.isFull()) await this.isDrained();

        const idx = ++this.writeIndex % this.MAX;

        result.then(x => {
            if (typeof this.waiting[idx] === "function") {
                this.waiting[idx](x); 
                delete this.done[idx];
            } else {
                this.done[idx] = x;
            }
        })
        
        this.work[idx] = result;

        if (this.writeIndex >= this.MAX) 
            this.writeIndex = this.writeIndex % this.MAX;
    }

    addTransform<W>(_tr: TransformFunction<S, W>): IFCA<T, S> {
        this.transforms.push(_tr);
        return this;
    }

    private isFull(): boolean {
        return this.readIndex === this.writeIndex % this.MAX;
    }

    private isDrained(): MaybePromise<void> {
        return this.work[(this.writeIndex + 1) % this.MAX];
    }

    async read(): Promise<AsyncIterable<S>> {
        // which item to read
        const readIndex = this.readIndex++ % this.MAX;
        // if this is the same item we're writing, then we're full
        if (readIndex === this.writeIndex % this.MAX) {
            await this.isDrained();
        }
        // this is the value, when it's already done
        let value = this.done[readIndex];
        // but if it's undefined
        if (typeof value === undefined) {
            // that means we need to wait for it
            if (this.work[readIndex]) {
                await this.work[readIndex];
                value = this.done[readIndex];
            } else {
                value = await new Promise((res: Waiting<S>) => {
                    this.waiting[readIndex] = res;
                });
            }

            delete this.waiting[readIndex];
            delete this.done[readIndex];
            delete this.work[readIndex];
        }
        return value; // ?????
    }

}