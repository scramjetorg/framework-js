import { IIFCA, TransformArray, TransformFunction } from ".";

type MaybePromise<Z> = Promise<Z> | Z;
type Waiting<Z> = ((x: Z) => void) | undefined;

const callif = <T extends (...args: Z) => void, Z extends any[]>(f: T|undefined, ...args: Z) => {
    f && f(...args);
    return !!f; // Not needed as we don't check return results. Also this is always true as long as there is a function. False when undefined.
};
// const t = console.log.bind(console);

// Not really needed? partition and length are constants and then result is index.
const consistentIndex = (index: number, partition:number, length:number) => {
   console.log('CONSISTENT INDEX: ' + index + ' partition: ' + partition + ' length: ' + length)
   return -partition * ~~((index + 1 - length)/partition) + index%partition;
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
    private _writeIndex = 0;
    private _readIndex = 0;
    private _debugReadIndex = 0;
    private _debugWriteIndex = 0;

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
        const debugReadIndex = this._debugReadIndex++;

        const index = consistentIndex(readIndex, this.maxParallel, this.work.length);

        console.log('___READ___ INDEX: ' + readIndex + ' CONSISTENT INDEX: ' + index + ' debugReadIndex: ' + debugReadIndex);
        
        const awaiting: Promise<any> | undefined = this.work[index];

        // if this is the same item we're writing, then we're full
        return awaiting
            ? awaiting.then(() => { 
                console.log('READ() AWAITING RESOLVED IDX: ' +  readIndex + ' debugReadIndex: ' + debugReadIndex)
                return this._read(readIndex, debugReadIndex)})
            : (() => {
                console.log('READ() IMMEDIATELLY IDX: ' + readIndex + ' debugReadIndex: ' + debugReadIndex)
                return this._read(readIndex, debugReadIndex)})() ;
    }

    write(data: S): MaybePromise<void> {
        if (this.ended) {
            throw new Error("Write after end");
        }

        const idx = this.writeIndex++;
        const debugWriteIndex = this._debugWriteIndex++;
        const result: Promise<T> = (this.transforms as TransformFunction<any, any>[])
            .reduce(
                (prev, transform) => prev.then(transform.bind(this)), 
                Promise.resolve(data)
            ) as Promise<unknown> as Promise<T>;
        
        // check if two items couldn't be overwriting items on maxParallel 
        // consecutive writes
        console.log('');
        console.log('WRITE this.isWorking: ' + this.isWorking(idx) + ' IDX: ' + idx + ' debugWriteIndex: ' + debugWriteIndex);
        return this.isWorking(idx)
            ? (() => {
                console.log('WRITE AFTER DRAIN... debugWriteIndex ' + debugWriteIndex)
                return this.isDrained().then(() => { 
                    console.log('...WRITE AFTER DRAINED');
                    return this._write(idx, result, debugWriteIndex)} 
                )})()
            : (() => { 
                console.log('WRITE AT ONCE debugWriteIndex: ' + debugWriteIndex);
                return this._write(idx, result, debugWriteIndex)})();
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

    private _read(idx: number, debugIDX: number): MaybePromise<T|null> {
        // this is the value, when it's already done
        let tmpvalue: T | undefined = this.done[idx];
        
        // let's mark this as read?
        // this.work[readIndex] = undefined;

        // but if it's undefined
        console.log('_READ: ' + idx + ' tmpvalue: ' + tmpvalue + ' debugReadIndex: ' + debugIDX); //+ ' ' + ' this.done: ' + this.done.map(i => console.log(i)) + 'this.ended: ' + this.ended + ' this.work: ' +JSON.stringify(this.work) + ' this.waiting: ' + JSON.stringify(this.waiting));
        console.log('DEBUG DONE: ');
        console.log(this.done[0]);
        console.log(this.done[1]);
        console.log(this.done[2]);
        console.log(this.done[3]);
        console.log('DEBUG WORK: ');
        console.log(this.work[0]);
        console.log(this.work[1]);
        console.log(this.work[2]);
        console.log(this.work[3]);
        console.log('DEBUG WAITING: ');
        console.log(this.waiting[0]);
        console.log(this.waiting[1]);
        console.log(this.waiting[2]);
        console.log(this.waiting[3]);
        console.log();

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
                    console.log('THE END')
                    return res(null);
                } else {
                    const resolver = (value: T|null) => {
                        const spliceit = this.waiting.length > this.maxParallel;
                        console.log('spliceit: ' + spliceit)

                        this.waiting[idx] = spliceit 
                            ? this.waiting.splice(this.maxParallel, 1)[0]
                            : undefined
                        ;

                        console.log('AFTER splice: ' + this.waiting[idx] + ' value: ' + value)
                        res(value);
                    }

                    console.log('WHAT IS HAPPENING HERE?');
                    console.log(this.waiting[idx]);

                    if (this.waiting[idx]) this.waiting.push(resolver);
                    else this.waiting[idx] = resolver;
                }
            }) as Promise<T|null>)
                .finally(() => {
                    callif(this.drain[idx]);
                    this.drain[idx] = undefined;
                })
        } else {
            // console.log('ELSE this.done: ' + JSON.stringify(this.done) + ' this.drain: ' + JSON.stringify(this.drain));
            this.done[idx] = undefined;
            callif(this.drain[idx]);
            this.drain[idx] = undefined;
            return tmpvalue;
        }
    }

    private _write(idx: number, _result: Promise<T>, writeIDX: number): void {
        console.log('_WRITE: ' + idx + ' result: ' + ' debugWriteIndex: ' + writeIDX + ' ' + _result.then(res => {
          //  console.log('WRITE RESOLVED: idx: ' + idx + " RES: " + JSON.stringify(res) + ' this.work: ' + JSON.stringify(this.work) + ' this.done: ' + JSON.stringify(this.done) + ' this.drain: ' + JSON.stringify(this.drain));
        }))
        let result: Promise<any> = _result;
        if (this.work[idx]) {
            this.work.push()
            result = this.work[idx] 
                ? Promise.all([_result, this.work[idx]]).then(([result]) => result)
                : _result;
        }

        result.then(x => {
            // console.log('_WRITE1 THEN IDX: ' + idx + ' x: ' + x + ' this.work: ' + JSON.stringify(this.work) + ' this.waiting: ' + JSON.stringify(this.waiting) + ' this.done: ' + JSON.stringify(this.done));
            this.work[idx] = this.work.length > this.maxParallel 
                ? this.work.splice(this.maxParallel, 1)[0]
                : undefined
            ;


            const waitForRead = idx === this.readIndex && this.done[idx] != null;
            const type = typeof this.waiting[idx];

            if (type === "function" || waitForRead) {
                const result = callif(this.waiting[idx], x);
                console.log('_WRITE WAIT IDX: ' + idx + ' x: ' + x + ' callif: ' + result + ' type: ' + type + ' waitForRead: ' + waitForRead);
            } else {
                this.done[idx] = x;
                console.log('_WRITE AFTER UNDEFINED FN: ' + JSON.stringify(this.done) + ' IDX: ' + idx + ' X: ' + x + ' waitForRead: ' + waitForRead)
            }

            console.log('FUNCTION AFTER CALLIF idx: ' + idx + ' this.waiting.length: ' + this.waiting.length + ' waitForRead: ' + waitForRead);
            console.log(this.waiting[0]);
            console.log(this.waiting[1]);
            console.log(this.waiting[2]);
            console.log(this.waiting[3]);
        });

        this.work[idx] = result;

        if (this.writeIndex >= this.maxParallel)
            this.writeIndex = this.writeIndex % this.maxParallel;
    }

}