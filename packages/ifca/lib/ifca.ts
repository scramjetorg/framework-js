import { IIFCA, TransformArray, TransformFunction } from ".";

type MaybePromise<Z> = Promise<Z> | Z;
type Waiting<Z> = ((x: Z) => void) | undefined;

/**
 * Helper function that calls passed function f if function is not undefined
 * 
 * @param {Function} f Function to be called
 * @param {Object} args Additional function arguments 
 * @returns {boolean}
 */
const callif = <T extends (...args: Z) => void, Z extends any[]>(f: T|undefined, ...args: Z) => {
    f && f(...args);
    return !!f; // Not needed as we don't check return results. Also this is always true as long as there is a function. False when undefined.
};
// const t = console.log.bind(console);

// AJ: Not really needed? partition and length are constants and then result is index.
// const consistentIndex = (index: number, partition:number, length:number) => {
//    return -partition * ~~((index + 1 - length)/partition) + index%partition;
// }

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
    private _resetIndex = false;

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

        // Reset index for next read
        if (this._resetIndex) { 
            this.readIndex = 0;
            this._resetIndex = false;
        }
        
        const awaiting: Promise<any> | undefined = this.work[readIndex];

        // if this is the same item we're writing, then we're full
        return awaiting
            ? awaiting.then(() => this._read(readIndex))
            : this._read(readIndex) ;
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
            ? this.isDrained().then(() => { 
                    return this._write(idx, result)} 
                )
            : this._write(idx, result)
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
        console.log('IFCA ADD TRANSFORM');
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

    private isDrained(): Promise<unknown> {
        const idx = (this.writeIndex + 1) % this.maxParallel;

        // Is that OR actualy working?
        const result = typeof this.done[idx] !== "undefined" 
                ? new Promise(res => this.drain[idx] = res)
                : Promise.resolve()
            ;
        return result;
    }

    private _read(idx: number): MaybePromise<T|null> {
        // this is the value, when it's already done
        let tmpvalue: T | undefined = this.done[idx];
        
        // let's mark this as read?
        // this.work[readIndex] = undefined;

        // but if it's undefined
        if (typeof tmpvalue === "undefined") {
            const isAllProcessed = this.work.every(item => item == null) && this.waiting.every(item => item == null);
            if (this.ended && isAllProcessed) return null;

            return (new Promise(async res => {
                // that means we need to wait for it
                if (this.work[idx]) {
                    await this.work[idx];
                    res(this.done[idx] as T);
                    this.done[idx] = undefined;
                } else if (this.ended && this.work.length === 0) { // THIS NEVER WORKS
                    return res(null);
                } else {
                    const resolver = (value: T|null) => {
                        const spliceit = this.waiting.length > this.maxParallel; // same logic as in this.work... it doesn't work. this.waiting.length is a constant
                        this.waiting[idx] = spliceit 
                            ? this.waiting.splice(this.maxParallel, 1)[0]
                            : undefined
                        ;
                        res(value);
                    }

                    // What's happening here?
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
            // Logic that removes undefined when done.length > maxParallel (waitForRead case)
            if (this.done.length > this.maxParallel) {
                const before = this.done.length;
                this.done = this.done.filter(d => d !== undefined)
                const after = this.done.length;
                const adjustIndex = before - after;
                this.readIndex -= adjustIndex; // reset read index;
                if (this.readIndex < 0 ) { 
                    this.readIndex = 0; // start from beginning
                } else {
                    this._resetIndex = true; // will reset index for next read
                }
                
            }
            return tmpvalue;
        }
    }

    private _write(idx: number, _result: Promise<T>): void {
        let result: Promise<any> = _result;
        if (this.work[idx]) {
            this.work.push() // What's the purpose? Works with 8x2 test correctly

            // result = this.work[idx] // Always going to be true
            //     ? (() => { 
            //         return Promise.all([_result, this.work[idx]]).then(([result]) => result) })()
            //     : (() => { 
            //         return _result})(); // POINTLESS
        } 

        result.then(x => {
            this.work[idx] = this.work.length > this.maxParallel // work.length is constant... therefore splice is never happening....
                ? this.work.splice(this.maxParallel, 1)[0] // ...does this ever happen - check logs.... NOPE!
                : undefined // Removes Promise { 12 } in 7+9 test
            ;


            // const waitForRead = idx === this.readIndex && this.done[idx] != null; // THIS BREAKS THE LAST ELEMENT
            const type = typeof this.waiting[idx];

            if (type === "function") {
                callif(this.waiting[idx], x);
            } else {
                // check if undefined first! don't overwrite
                if (this.done[idx] === undefined) {
                    this.done[idx] = x;
                } else {
                    this.done.push(x)
                }
            }        
        });

        this.work[idx] = result;

        if (this.writeIndex >= this.maxParallel)
            this.writeIndex = this.writeIndex % this.maxParallel;
    }

}