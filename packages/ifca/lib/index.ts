import { cpus } from "os";

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)
export type IFCAOptions = Partial<{ strict: boolean }>
export type ErrorWithReason = Error & { cause?: Error };
export type TransformErrorHandler<S, T> = (err: ErrorWithReason|undefined, chunk: S) => MaybePromise<T|undefined>;
export type TransformArray<S, T> = [TransformFunction<S, T>] | [
    TransformFunction<S, any>,
    ...TransformFunction<any, any>[],
    TransformFunction<any, T>
];

const isAsync = (func?: any) => !!func && func[Symbol.toStringTag] === 'AsyncFunction';

export interface IIFCA<S,T,I extends IIFCA<S,any,any>> {
    // TODO: This may need a setter if maxParallel is increased so that chunks are not waiting for drain.
    maxParallel: number;
    transforms: TransformArray<S, T>;
    handlers: TransformErrorHandler<S, T>[];

    status?: string;

    /**
     * Write (add chunk)
     * 
     * @param chunk Chunk to be processed
     */
    write(chunk: S): MaybePromise<void>;
    end(): MaybePromise<void>;

    read(): MaybePromise<T|null>;
    
    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<T,W>): IIFCA<S,W,this>;
    removeTransform(): I;
}

type ChunkResolver<S> = [(chunk: S|null) => void, (err?: Error|null) => void];
type MaybePromise<S> = Promise<S> | S;
type NullTerminatedArray<X extends any[]> = X | [...X, null]

export class IFCA<S,T,I extends IFCA<S,any,any>> implements IIFCA<S,T,I> {

    constructor(
        public maxParallel = 2 * cpus().length, 
        initialTransform: TransformFunction<S,T>,
        options: IFCAOptions = {}
    ) {
        this.transforms = [initialTransform];
        this.strict = !!options.strict;
    }

    transforms: TransformArray<S, T>;

    private processing: Promise<any>[] = []
    public handlers = [] as TransformErrorHandler<S,T>[];
    private readable: NullTerminatedArray<T[]> = [];
    private readers: ChunkResolver<T>[] = [];
    private ended: boolean = false;
    private readonly strict: boolean;

    get status() {
        return "R,".repeat(this.readers.length) + this.processing.slice(this.readers.length).map((x,i) => this.readable[this.readers.length + i] ? 'd,' : 'p,')
    }

    write(_chunk: S): MaybePromise<void> {
        if (this.ended) throw new Error("Write after end");

        const pos = this.processing.length;
        const drain: MaybePromise<any> = pos < this.maxParallel 
            ? undefined 
            : this.processing[pos - this.maxParallel]
        ;
        const chunkBeforeThisOne = this.processing[pos - 1];
        const currentChunkResult = this.strict ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);
        
        this.processing.push(
            this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult)
        );

        return drain;
    }

    // TODO: here's a low hanging fruit for implementing non-ordered processing
    private makeProcessingItem(chunkBeforeThisOne: Promise<any>, currentChunkResult: MaybePromise<T>): Promise<any> {
        const currentSafeChunkResult = 
            "catch" in currentChunkResult
                ? currentChunkResult.catch(
                    (err: Error) => this.readers.length
                        ? (this.readers.shift() as ChunkResolver<T>)[1](err)
                        : undefined
                    )
                : currentChunkResult

        return Promise.all([
            chunkBeforeThisOne?.catch(e => e !== undefined ? Promise.reject(e) : undefined), 
            currentSafeChunkResult
        ])
            .then(([, result]) => {
                // console.log("result", result, this.processing.length, this.readers.length);

                this.processing.shift();
                if (result !== undefined)
                    this.readers.length
                        ? (this.readers.shift() as ChunkResolver<T>)[0](result)
                        : this.readable.push(result);
            });
    }

    private makeStrictTransformChain(_chunk: S): MaybePromise<T> {
        let funcs = [...this.transforms] as TransformFunction<any, any>[];
        if (!funcs.length) return _chunk as unknown as T;
        
        let value: any = _chunk;

        // Synchronous start
        const syncFunctions = funcs.findIndex(isAsync);
        if (syncFunctions > 0) {
            value = this.makeSynchronousChain(funcs.slice(0, syncFunctions))(value);
            funcs = funcs.slice(syncFunctions);
        }

        if (!funcs.length) return value;

        let next = Promise.resolve(value);
        while(funcs.length) {
            next = next.then(funcs.shift());

            const syncFunctions = funcs.findIndex(isAsync);
            
            if (syncFunctions > 0) {
                next = next.then(this.makeSynchronousChain(funcs.slice(0, syncFunctions)));
                funcs = funcs.slice(syncFunctions);
            }
        }
        return next;
    }

    private makeSynchronousChain<X,Y>(funcs: TransformFunction<X, Y>[]): (a: X) => Y {
        return funcs.reduce.bind(funcs, (acc, func) => func(acc as any)) as (a: X) => Y;
    }
        
    private makeTransformChain(_chunk: S): Promise<T> {
        const ret = (this.transforms as TransformFunction<any, any>[])
            .reduce(
                (prev, transform) => {
                    // TODO: if (transform.isHandler === true) prev.catch(transform);
                    return prev.then(transform.bind(this))
                },
                Promise.resolve(_chunk)
            ) as Promise<unknown> as Promise<T>;

        // Promise.resolve(1)
        //     .then(b => b+2)
        //     .then(a => a+1)
        //     .then(x, y)
        //     .catch(z)

        if (this.handlers) {
            const handlers = this.handlers;
            ret.catch(async error => {
                let ret: T|undefined;
                for (const hnd of handlers) {
                    try {
                        ret = await hnd(error, _chunk);
                    } catch(e) {
                        e.cause = error;
                        error = e;
                    }
                }
                if (!ret) return Promise.reject(undefined);
                return ret;
            })
        }

        return ret;
    }

    end(): MaybePromise<void> {
        const last = this.processing[this.processing.length - 1];
        
        if (last) 
            return last.then(() => this.end())
        this.handleEnd();
    }

    private handleEnd() {
        // console.log("HE");
        this.ended = true;
        this.readers.slice(this.processing.length).forEach(([res]) => res(null));
        this.readable.push(null as unknown as T);
        return null;
    }

    read(): MaybePromise<T|null> {
        // console.log("R", this.ended, this.readable[0], this.readable.length, this.processing.length)

        const ret = this.processing.shift();
        if (this.readable[0] === null)
            return this.handleEnd();
        else if (this.readable[0])
            return this.readable.shift() as T;
        else if (ret)
            return ret.then(() => this.read());
        else if (this.ended)
            return null;

        return new Promise((...res) => this.readers.push(res));
    }

    last(): PromiseLike<T> { 
        return this.processing[this.processing.length - 1];
    }

    addErrorHandler(handler: TransformErrorHandler<S,T>): this {
        this.handlers.push(handler);

        return this;
    }

    addTransform<W>(_tr: TransformFunction<T, W>): IFCA<S, W, this> {
        (this.transforms as any[]).push(_tr);
        return this as IFCA<S,unknown,any> as IFCA<S,W,this>;
    }

    // Remove transform (pop)
    removeTransform(): I  {
        this.transforms.shift();
        return this as IFCA<S,unknown,any> as I;
    }

}