import { IIFCA, TransformArray, TransformFunction } from ".";

type MaybePromise<Z> = Promise<Z> | Z;
type Waiting<Z> = ((x: Z) => void) | undefined;

const callif = <T extends (...args: Z) => void, Z extends any[]>(f: T|undefined, ...args: Z) => {
    f && f(...args);
    return !!f; // Not needed as we don't check return results. Also this is always true as long as there is a function. False when undefined.
};
// const t = console.log.bind(console);

// AJ: Not really needed? partition and length are constants and then result is index.
// const consistentIndex = (index: number, partition:number, length:number) => {
//    return -partition * ~~((index + 1 - length)/partition) + index%partition;
// }

const logger = (msg:string, array: any[]|null = null) => {
    console.log(msg);
    if (array) {
        for (let i = 0; i < array.length; i++) {
            console.log(array[i]);
        }
        console.log('Length: ' + array.length);
    }
    console.log();
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

        // const index = consistentIndex(readIndex, this.maxParallel, this.work.length);
        logger('READ INDEX: ' + readIndex + /* ' CONSISTENT INDEX: ' + index + */ ' debugReadIndex: ' + debugReadIndex);
        logger('READ WORK', this.work);
        
        const awaiting: Promise<any> | undefined = this.work[readIndex];

        // if this is the same item we're writing, then we're full
        return awaiting
            ? awaiting.then(() => { 
                logger('READ() AWAITING RESOLVED IDX: ' +  readIndex + ' debugReadIndex: ' + debugReadIndex)
                return this._read(readIndex, debugReadIndex)})
            : (() => {
                logger('READ() IMMEDIATELLY IDX: ' + readIndex + ' debugReadIndex: ' + debugReadIndex)
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
        logger('WRITE this.isWorking(idx): ' + this.isWorking(idx) + ' idx: ' + idx + ' debugWriteIndex: ' + debugWriteIndex);
        return this.isWorking(idx)
            ? (() => {
                logger('WRITE AFTER DRAIN... debugWriteIndex ' + debugWriteIndex)
                return this.isDrained().then(() => { 
                    logger('...WRITE AFTER DRAINED');
                    return this._write(idx, result, debugWriteIndex)} 
                )})()
            : (() => { 
                logger('WRITE AT ONCE debugWriteIndex: ' + debugWriteIndex);
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

    private isDrained(): Promise<unknown> {
        const idx = (this.writeIndex + 1) % this.maxParallel;

  
        logger('IS DRAINED this.work[idx]: ' + this.work[idx] + ' idx: ' + idx + ' writeIndex: ' + this.writeIndex, this.work);
        logger('IS DRAINED done:', this.done);
        // Is that OR actualy working?
        const result = typeof this.done[idx] !== "undefined" 
                ? (() => { 
                    logger('IS DRAINED assign res to this.drain[idx]');
                    return new Promise(res => this.drain[idx] = res) })()
                : (() => { 
                    logger('IS DRAINED resolve')
                    return Promise.resolve()})()
            ;
        logger('IS DRAINED result: ' + result)
        return result;
    }

    private _read(idx: number, debugIDX: number): MaybePromise<T|null> {
        // this is the value, when it's already done
        let tmpvalue: T | undefined = this.done[idx];
        
        // let's mark this as read?
        // this.work[readIndex] = undefined;

        // but if it's undefined
        logger('_READ: ' + idx + ' tmpvalue: ' + tmpvalue + ' debugReadIndex: ' + debugIDX);
        logger('READ.DONE:', this.done);
        logger('READ.WORK:', this.work);
        logger('READ.WAITING:', this.waiting);


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
                    logger('THE END')
                    return res(null);
                } else {
                    const resolver = (value: T|null) => {
                        const spliceit = this.waiting.length > this.maxParallel;
                        logger('spliceit: ' + spliceit)

                        this.waiting[idx] = spliceit 
                            ? this.waiting.splice(this.maxParallel, 1)[0]
                            : undefined
                        ;

                        logger('AFTER splice value: ' + value + ' WAITING: ',  this.waiting)
                        res(value);
                    }

                    logger('WHAT IS HAPPENING HERE? WAITING:', this.waiting);

                    if (this.waiting[idx]) this.waiting.push(resolver);
                    else this.waiting[idx] = resolver;
                }
            }) as Promise<T|null>)
                .finally(() => {
                    callif(this.drain[idx]);
                    this.drain[idx] = undefined;
                })
        } else {
            logger('ELSE idx: ' + idx + ' tmpvalue: ' + tmpvalue);
            logger('ELSE DONE', this.done)
            logger('ELSE DRAIN', this.drain);

            this.done[idx] = undefined;
            callif(this.drain[idx]);
            this.drain[idx] = undefined;
            return tmpvalue;
        }
    }

    private _write(idx: number, _result: Promise<T>, writeIDX: number): void {
        logger('_WRITE: ' + idx + ' debugWriteIndex: ' + writeIDX + ' ');
        let result: Promise<any> = _result;
        if (this.work[idx]) {
            logger('PUSH TO WORK BEFORE:', this.work)

            this.work.push() // What's the purpose? Works with 8x2 test correctly
            logger('PUSH TO WORK AFTER:', this.work)

            // result = this.work[idx] // Always going to be true
            //     ? (() => { 
            //         console.log('ALWAYS TRUE WRITE RETURN PROMISE');
            //         return Promise.all([_result, this.work[idx]]).then(([result]) => result) })()
            //     : (() => { 
            //         console.log('FALSE RETURN RESULT - CAN IT HAPPEN?')
            //         return _result})(); // POINTLESS
        } 

        result.then(x => {
            logger('_WRITE.THEN IDX: ' + idx + ' x: ' + x + ' debugWriteIndex: ' + writeIDX);
            logger('_WRITE.THEN() WORK:', this.work)

            logger('_WRITE.THEN() DONE:', this.done)

            logger('_WRITE.THEN() WAITING:', this.waiting)

            this.work[idx] = this.work.length > this.maxParallel 
                ? (() => { 
                    logger('_WRITE.THEN SPLICE')
                    return this.work.splice(this.maxParallel, 1)[0]})()
                : (() => { 
                    logger('_WRITE.THEN UNDEFINED')
                    return undefined})()
            ;


            const waitForRead = idx === this.readIndex && this.done[idx] != null;
            const type = typeof this.waiting[idx];

            if (type === "function" || waitForRead) {
                callif(this.waiting[idx], x);
                logger('_WRITE WAIT idx: ' + idx + ' x: ' + x + ' type: ' + type + ' waitForRead: ' + waitForRead);
            } else {
                this.done[idx] = x;
                logger('_WRITE.THEN DONE UPDATED idx: ' + idx + ' VALUE: ' + this.done[idx]);
            }

            logger('FUNCTION AFTER CALLIF idx: ' + idx + ' this.waiting.length: ' + this.waiting.length + ' waitForRead: ' + waitForRead);
            logger('WAITING: ', this.waiting);
        
        });

        this.work[idx] = result;
        logger('FINAL WORK AFTER WRITE:', this.work);

        if (this.writeIndex >= this.maxParallel)
            this.writeIndex = this.writeIndex % this.maxParallel;
    }

}