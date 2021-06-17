import { IIFCA, TransformArray, TransformFunction } from ".";

type MaybePromise<Z> = Promise<Z> | Z;
type Waiting<Z> = ((x: Z) => void) | undefined;

const callif = <T extends (...args: Z) => void, Z extends any[]>(f: T|undefined, ...args: Z) => {
    f && f(...args);
    return !!f;
};
// const t = console.log.bind(console);

const consistentIndex = (index: number, partition:number, length:number) => 
    -partition * ~~((index + 1 - length)/partition) + index%partition;

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
    private _writeIndex = 0;
    private _readIndex = 0;

    private get writeIndex() {
        return this._writeIndex % this.maxParallel;
    }
    private set writeIndex(value) {
        this._writeIndex = value;
    }

    private get readIndex() {
        return this._readIndex % this.maxParallel;
    }
    private set readIndex(value) {
        this._readIndex = value;
    }

    private ended: boolean = false;

    get status() {
        let x = Array(this.maxParallel);

        for (let i = 0; i < x.length; i++) {
            x[i] = this.done[i] ? "d" : this.waiting[i] ? "f" : this.work[i] ? "w" : ".";
        }

        return [...x,'-',this.writeIndex,'x',this.readIndex,'+D',this.waiting.length,'+W',this.work.length].join('');
    }

    read(): MaybePromise<T|null> {
        // which item to read
        const readIndex = this.readIndex++;

        const awaiting: Promise<any> | undefined = this.work[
            consistentIndex(readIndex, this.maxParallel, this.work.length)
        ];

        // if this is the same item we're writing, then we're full
        return awaiting
            ? awaiting.then(() => this._read(readIndex))
            : this._read(readIndex);
    }

    write(data: S): MaybePromise<void> {
        if (this.ended) {
            throw new Error("Write after end");
        }

        const idx = this.writeIndex++;
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

        return this.work[idx] || (
            typeof this.done[idx] !== "undefined" 
                ? new Promise(res => this.drain[idx] = res)
                : Promise.resolve()
            )
        ;
    }

    private _read(idx: number): MaybePromise<T|null> {
        // this is the value, when it's already done
        let tmpvalue: T | undefined = this.done[idx];
        
        // let's mark this as read?
        // this.work[readIndex] = undefined;

        // but if it's undefined
        if (typeof tmpvalue === "undefined") {
            const isAllProcessed = this.work.every(item => item == null );
            if (this.ended && isAllProcessed) return null;

            return (new Promise(async res => {
                // that means we need to wait for it
                if (this.work[idx]) {
                    await this.work[idx];
                    res(this.done[idx] as T);
                    this.done[idx] = undefined;
                } else if (this.ended && this.work.length === 0) {
                    return res(null);
                } else {
                    const resolver = (value: T|null) => {
                        this.waiting[idx] = this.waiting.length > this.maxParallel 
                            ? this.waiting.splice(this.maxParallel, 1)[0]
                            : undefined
                        ;
                        res(value);
                    }

                    if (this.waiting[idx]) this.waiting.push(resolver);
                    else this.waiting[idx] = resolver;
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

    private _write(idx: number, _result: Promise<T>): void {
        let result: Promise<any> = _result;
        if (this.work[idx]) {
            this.work.push()
            result = this.work[idx] 
                ? Promise.all([_result, this.work[idx]]).then(([result]) => result)
                : _result;
        }

        result.then(x => {
            this.work[idx] = this.work.length > this.maxParallel 
                ? this.work.splice(this.maxParallel, 1)[0]
                : undefined
            ;
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