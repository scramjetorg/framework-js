import { Readable } from "stream";
import { createReadStream, promises as fs } from "fs";
import { BaseStream } from "./base-stream";
import { IFCA } from "../ifca";
import { IFCAChain } from "../ifca/ifca-chain";
import { createResolvablePromiseObject, isAsyncFunction } from "../utils";
import { AnyIterable, StreamConstructor, DroppedChunk, ResolvablePromiseObject, TransformFunction, MaybePromise, StreamOptions } from "../types";
import { checkTransformability } from "../decorators";

type Reducer<IN, OUT> = {
    isAsync: boolean,
    value?: OUT,
    onFirstChunkCallback: Function,
    onChunkCallback: (chunk: IN) => MaybePromise<void>
};

export class DataStream<IN, OUT = IN> implements BaseStream<IN, OUT>, AsyncIterable<OUT> {
    constructor(
        protected options: StreamOptions = { maxParallel: 4 },
        protected parentStream?: DataStream<IN, any>
    ) {
        this.corked = createResolvablePromiseObject<void>();

        if (!this.parentStream) {
            this.ifcaChain = new IFCAChain<IN>();
            this.ifca = this.ifcaChain.create<IN | OUT, OUT>(options);
        } else {
            this.ifcaChain = this.parentStream.ifcaChain;
            this.ifca = this.ifcaChain.get<IN | OUT, OUT>();
        }
    }

    protected corked: ResolvablePromiseObject<void> | null;
    protected ifcaChain: IFCAChain<IN>;
    protected ifca: IFCA<IN | OUT, OUT, any>;

    // Whether we can write to, end, pasue and resume this stream instance.
    protected writable: boolean = true;
    // Whether we can read from this stream instance.
    protected readable: boolean = true;
    // Whether we can add transforms to this stream instance.
    protected transformable: boolean = true;

    static from<IN extends any, STREAM extends DataStream<IN>>(
        this: StreamConstructor<STREAM>,
        input: Iterable<IN> | AsyncIterable<IN> | Readable,
        options?: StreamOptions
    ): STREAM {
        return (new this(options)).readSource(input);
    }

    static fromFile<IN extends any, STREAM extends DataStream<IN>>(
        this: StreamConstructor<STREAM>,
        path: string,
        options?: StreamOptions
    ): STREAM {
        return (new this(options)).readSource(createReadStream(path, options?.readStream));
    }

    [Symbol.asyncIterator]() {
        if (!this.readable) {
            throw new Error("Stream is not readable.");
        }

        this.uncork();

        return {
            next: async () => {
                const value = await this.ifca.read();

                return Promise.resolve({ value, done: value === null } as IteratorResult<OUT, boolean>);
            }
        };
    }

    write(chunk: IN): MaybePromise<void> {
        this.uncork();

        return this.ifcaChain.write(chunk);
    }

    read(): MaybePromise<OUT|null> {
        if (!this.readable) {
            throw new Error("Stream is not readable.");
        }

        this.uncork();

        return this.ifcaChain.read<OUT>();
    }

    pause(): void {
        this.cork();
    }

    resume(): void {
        this.uncork();
    }

    end(): MaybePromise<void> {
        return this.ifcaChain.end();
    }

    map<ARGS extends any[] = []>(
        callback: TransformFunction<OUT, IN, ARGS>, ...args: ARGS): DataStream<IN>;
    map<NEW_OUT, ARGS extends any[] = []>(
        callback: TransformFunction<OUT, NEW_OUT, ARGS>, ...args: ARGS): DataStream<IN, NEW_OUT>;

    @checkTransformability
    map<NEW_OUT, ARGS extends any[] = []>(
        callback: TransformFunction<OUT, NEW_OUT, ARGS>,
        ...args: ARGS
    ): DataStream<IN, NEW_OUT> {
        if (args?.length) {
            this.ifcaChain.add(
                this.ifca.addTransform(this.injectArgsToCallback<NEW_OUT, typeof args>(callback, args))
            );
        } else {
            this.ifcaChain.add(
                this.ifca.addTransform(callback)
            );
        }

        return this.createChildStream<NEW_OUT>();
    }

    @checkTransformability
    filter<ARGS extends any[] = []>(
        callback: TransformFunction<OUT, Boolean, ARGS>,
        ...args: ARGS
    ): DataStream<IN, OUT> {
        const chunksFilter = (chunk: OUT, result: Boolean) => result ? chunk : DroppedChunk;
        const ifca = this.ifca.addTransform(
            this.injectArgsToCallbackAndMapResult(callback, chunksFilter, args)
        );

        this.ifcaChain.add(ifca);

        return this.createChildStream<OUT>();
    }

    @checkTransformability
    batch<ARGS extends any[] = []>(
        callback: TransformFunction<OUT, Boolean, ARGS>,
        ...args: ARGS
    ): DataStream<IN, OUT[]> {
        let currentBatch: OUT[] = [];

        this.ifcaChain.create<OUT[], OUT[]>(this.options);
        const newStream = this.createChildStreamSuperType<OUT[]>();
        const callbacks = {
            onChunkCallback: async (chunk: OUT) => {
                const emitBatch = await callback(chunk, ...args);

                currentBatch.push(chunk);

                if (emitBatch) {
                    await newStream.ifca.write([...currentBatch]);

                    currentBatch = [];
                }
            },
            onEndCallback: async () => {
                if (currentBatch.length > 0) {
                    await newStream.ifca.write(currentBatch);
                }

                newStream.ifca.end();
            }
        };

        (this.getReaderAsyncCallback(false, callbacks))();

        return newStream;
    }

    flatMap<ARGS extends any[] = []>(
        callback: TransformFunction<OUT, AnyIterable<IN>, ARGS>, ...args: ARGS): DataStream<IN>;
    flatMap<NEW_OUT, ARGS extends any[] = []>(
        callback: TransformFunction<OUT, AnyIterable<NEW_OUT>, ARGS>, ...args: ARGS): DataStream<IN, NEW_OUT>;

    @checkTransformability
    flatMap<NEW_OUT, ARGS extends any[] = []>(
        callback: TransformFunction<OUT, AnyIterable<NEW_OUT>, ARGS>,
        ...args: ARGS
    ): DataStream<IN, NEW_OUT> {
        this.ifcaChain.create<NEW_OUT, NEW_OUT>(this.options);
        const newStream = this.createChildStream<NEW_OUT>();
        const callbacks = {
            onChunkCallback: async (chunk: OUT) => {
                const items = await callback(chunk, ...args);

                for await (const item of items) {
                    await newStream.ifca.write(item);
                }
            },
            onEndCallback: async () => {
                newStream.ifca.end();
            }
        };

        (this.getReaderAsyncCallback(false, callbacks))();

        return newStream;
    }

    @checkTransformability
    async reduce<NEW_OUT = OUT>(
        callback: (previousValue: NEW_OUT, currentChunk: OUT) => MaybePromise<NEW_OUT>,
        initial?: NEW_OUT
    ): Promise<NEW_OUT> {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#parameters
        //
        // initialValue (optional):
        // A value to which previousValue is initialized the first time the callback is called.
        // If initialValue is specified, that also causes currentValue to be initialized to the first
        // value in the array. If initialValue is not specified, previousValue is initialized to the first
        // value in the array, and currentValue is initialized to the second value in the array.

        const reducer = this.getReducer<NEW_OUT>(callback, initial);
        const reader = reducer.isAsync
            ? this.getReaderAsyncCallback(true, reducer)
            : this.getReader(true, reducer);

        return reader().then(() => reducer.value as NEW_OUT);
    }

    @checkTransformability
    async toArray(): Promise<OUT[]> {
        const chunks: Array<OUT> = [];
        const reader = this.getReader(true, { onChunkCallback: chunk => { chunks.push(chunk); } });

        return reader().then(() => chunks);
    }

    // TODO
    // Helper created to be used in E2E test.
    // After DataStream will be a subclass of Transform, it can be simply piped to naitve writeStream.
    @checkTransformability
    async toFile(filePath: string): Promise<void> {
        const results: OUT[] = await this.toArray();

        await fs.writeFile(filePath, results.map(line => `${line}\n`).join(""));
    }

    // Creates a new instance of this class. Marks this stream as non-readable and non-transfromable.
    // Passes this stream as a parent.
    //
    // This method is used by transforms so derived classes can override it to make transfroms
    // return an instances of its own class not a super class.
    //
    // It should be used by transfoms which do not force "OUT" type change.
    protected createChildStream(): DataStream<IN, OUT>;
    protected createChildStream<NEW_OUT>(): DataStream<IN, NEW_OUT>;
    protected createChildStream<NEW_OUT>(): DataStream<IN, NEW_OUT> {
        this.readable = false;
        this.transformable = false;

        return new DataStream<IN, NEW_OUT>(this.options, this);
    }

    // Creates a new instance of this class. Marks this stream as non-readable and non-transfromable.
    // Passes this stream as a parent.
    //
    // This method is identical to "createChildStream", however its purpose is different. It should
    // be used by transforms which always forces "OUT" type change.
    // For example ".batch()" always changes "IN" type to "IN[]" which means some specialized streams,
    // like "StringStream", will be automatically transformed to super class instance.
    protected createChildStreamSuperType<NEW_OUT>(): DataStream<IN, NEW_OUT> {
        this.readable = false;
        this.transformable = false;

        return new DataStream<IN, NEW_OUT>(this.options, this);
    }

    protected cork(): void {
        if (this.parentStream) {
            this.parentStream.cork();
        }

        if (this.corked === null) {
            this.corked = createResolvablePromiseObject<void>();
        }
    }

    protected uncork(): void {
        if (this.parentStream) {
            this.parentStream.uncork();
        }

        if (this.corked) {
            this.corked.resolver();
            this.corked = null;
        }
    }

    protected getReducer<NEW_OUT>(
        callback: (previousValue: NEW_OUT, currentChunk: OUT) => MaybePromise<NEW_OUT>,
        initial?: NEW_OUT
    ): Reducer<OUT, NEW_OUT> {
        const reducer: any = {
            isAsync: isAsyncFunction(callback),
            value: initial
        };

        reducer.onFirstChunkCallback = async (chunk: OUT): Promise<void> => {
            if (initial === undefined) {
                // Here we should probably check if typeof chunk is U.
                reducer.value = chunk as unknown as NEW_OUT;
            } else {
                reducer.value = await callback(reducer.value as NEW_OUT, chunk);
            }
        };

        if (reducer.isAsync) {
            reducer.onChunkCallback = async (chunk: OUT): Promise<void> => {
                reducer.value = await callback(reducer.value as NEW_OUT, chunk) as NEW_OUT;
            };
        } else {
            reducer.onChunkCallback = (chunk: OUT): void => {
                reducer.value = callback(reducer.value as NEW_OUT, chunk) as NEW_OUT;
            };
        }

        return reducer as Reducer<OUT, NEW_OUT>;
    }

    protected getReader(
        uncork: boolean,
        callbacks: {
            onChunkCallback: (chunk: OUT) => void,
            onFirstChunkCallback?: Function,
            onEndCallback?: Function
        }
    ): () => Promise<void> {
        /* eslint-disable complexity */
        return async () => {
            if (uncork && this.corked) {
                this.uncork();
            }

            let chunk = this.ifca.read();

            // A bit of code duplication but we don't want to have unnecessary if inside a while loop
            // which is called for every chunk or wrap the common code inside another function due to performance.
            if (callbacks.onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk !== null) {
                    await callbacks.onFirstChunkCallback(chunk);
                    chunk = this.ifca.read();
                }
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk === null) {
                    break;
                }

                callbacks.onChunkCallback(chunk);

                chunk = this.ifca.read();
            }

            if (callbacks.onEndCallback) {
                await callbacks.onEndCallback.call(this);
            }
        };
        /* eslint-enable complexity */
    }

    // This is duplicated '.getReader()' method with the only difference that 'onChunkCallback'
    // is an async function so we have to 'await' on it for each chunk. Since it has significant effect
    // on processing time (and makes it asynchronous) I have extracted it as a separate method.
    protected getReaderAsyncCallback(
        uncork: boolean,
        callbacks: {
            onChunkCallback: (chunk: OUT) => MaybePromise<void>,
            onFirstChunkCallback?: Function,
            onEndCallback?: Function
        }
    ): () => Promise<void> {
        /* eslint-disable complexity */
        return async () => {
            if (uncork && this.corked) {
                this.uncork();
            }

            let chunk = this.ifca.read();

            // A bit of code duplication but we don't want to have unnecessary if inside a while loop
            // which is called for every chunk or wrap the common code inside another function due to performance.
            if (callbacks.onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk !== null) {
                    await callbacks.onFirstChunkCallback(chunk);
                    chunk = this.ifca.read();
                }
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }

                if (chunk === null) {
                    break;
                }

                await callbacks.onChunkCallback(chunk);

                chunk = this.ifca.read();
            }

            if (callbacks.onEndCallback) {
                await callbacks.onEndCallback.call(this);
            }
        };
        /* eslint-enable complexity */
    }

    // Native node readables also implement AsyncIterable interface.
    protected readSource(iterable: Iterable<IN> | AsyncIterable<IN>): this {
        // We don't want to return or wait for the result of the async call,
        // it will just run in the background reading chunks as they appear.
        (async (): Promise<void> => {
            if (this.corked) {
                await this.corked.promise;
            }

            for await (const data of iterable) {
                if (this.corked) {
                    await this.corked.promise;
                }

                const drain = this.ifca.write(data);

                if (drain instanceof Promise) {
                    await drain;
                }
            }

            this.ifca.end();
        })();

        return this;
    }

    protected injectArgsToCallback<NEW_OUT, ARGS extends any[]>(
        callback: TransformFunction<OUT, NEW_OUT, ARGS>,
        args: ARGS
    ): (chunk: OUT) => Promise<NEW_OUT> | NEW_OUT {
        if (isAsyncFunction(callback)) {
            return async (chunk: OUT): Promise<NEW_OUT> => {
                return await callback(chunk, ...args) as unknown as Promise<NEW_OUT>;
            };
        }

        return (chunk: OUT): NEW_OUT => {
            return callback(chunk, ...args) as NEW_OUT;
        };
    }

    protected injectArgsToCallbackAndMapResult<NEW_OUT, MAP_TO, ARGS extends any[]>(
        callback: TransformFunction<OUT, NEW_OUT, ARGS>,
        resultMapper: (chunk: OUT, result: NEW_OUT) => MAP_TO,
        args: ARGS
    ): (chunk: OUT) => Promise<MAP_TO> | MAP_TO {
        if (isAsyncFunction(callback)) {
            return async (chunk: OUT): Promise<MAP_TO> => {
                return resultMapper(chunk, await callback(chunk, ...args)) as unknown as Promise<MAP_TO>;
            };
        }

        return (chunk: OUT): MAP_TO => {
            return resultMapper(chunk, callback(chunk, ...args) as NEW_OUT) as MAP_TO;
        };
    }
}
