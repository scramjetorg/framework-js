import { Readable, Writable } from "stream";
import { createReadStream, createWriteStream } from "fs";
import { BaseStream } from "./base-stream";
import { IFCA } from "../ifca";
import { IFCAChain } from "../ifca/ifca-chain";
import { createResolvablePromiseObject, isAsyncFunction } from "../utils";
import { AnyIterable, StreamConstructor, DroppedChunk, ResolvablePromiseObject, TransformFunction, MaybePromise, StreamOptions } from "../types";
import { checkTransformability } from "../decorators";
import { StreamAsNodeWritableProxy } from "./proxies/stream-node-writable-proxy";

type Reducer<IN, OUT> = {
    isAsync: boolean,
    value?: OUT,
    onFirstChunkCallback: Function,
    onChunkCallback: (chunk: IN) => MaybePromise<void>
};

type WritableProxy<IN> = {
    write: (chunk: IN) => MaybePromise<void>,
    end: () => void
};

type Pipe<IN> = {
    destination: BaseStream<IN, any> | WritableProxy<IN>,
    options: { end: boolean }
};

export class DataStream<IN, OUT = IN> implements BaseStream<IN, OUT>, AsyncIterable<OUT> {
    constructor(
        protected options: StreamOptions = { maxParallel: 4 },
        protected parentStream?: DataStream<IN, any>
    ) {
        if (!this.parentStream) {
            this.ifcaChain = new IFCAChain<IN>();
            this.ifca = this.ifcaChain.create<IN | OUT, OUT>(options);
            this.pipes = [];
        } else {
            this.ifcaChain = this.parentStream.ifcaChain;
            this.ifca = this.ifcaChain.get<IN | OUT, OUT>();
            this.pipes = this.parentStream.pipes;
        }
    }

    protected corked: ResolvablePromiseObject<void> | null = createResolvablePromiseObject<void>();
    protected ifcaChain: IFCAChain<IN>;
    protected ifca: IFCA<IN | OUT, OUT, any>;
    protected pipes: Array<Pipe<OUT>>;

    // All streams in chain are writable.
    // Only the last stream created through transforms (the one with no children streams)
    // is readable, transformable and pipeable.
    // Piped source stream (one on which pipe() was called) is writable, readable, pipeable but not transformable.

    // Whether we can write to, end, pasue and resume this stream instance.
    protected writable: boolean = true;
    // Whether we can read from this stream instance.
    protected readable: boolean = true;
    // Whether we can add transforms to this stream instance.
    protected transformable: boolean = true;
    // Whether we can pipe from this stream.
    protected pipeable: boolean = true;
    // Whether this stream has been piped from.
    protected isPiped: boolean = false;

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

    @checkTransformability
    each<ARGS extends any[] = []>(callback: TransformFunction<OUT, void, ARGS>, ...args: ARGS): DataStream<IN, OUT> {
        const eachCallback = isAsyncFunction(callback)
            ? async (chunk: OUT) => { await callback(chunk, ...args); return chunk; }
            : (chunk: OUT) => { callback(chunk, ...args); return chunk; };

        this.ifcaChain.add(
            this.ifca.addTransform(eachCallback)
        );

        return this.createChildStream<OUT>();
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

    pipe<DEST extends BaseStream<OUT, any>>(destination: DEST, options?: { end: boolean }): DEST;
    pipe<DEST extends Writable>(destination: DEST, options?: { end: boolean }): DEST;
    pipe<DEST extends BaseStream<OUT, any> | Writable>(
        destination: DEST,
        options: { end: boolean } = { end: true }
    ): DEST {
        if (!this.pipeable) {
            throw new Error("Stream is not pipeable.");
        }

        this.transformable = false;

        if ((destination as any).ifca) {
            this.pipes.push({ destination: destination as BaseStream<OUT, any>, options: options });
        } else {
            let onDrain: ResolvablePromiseObject<void> | null = null;

            const writable = destination as Writable;
            const drainCallback = () => {
                if (onDrain) {
                    onDrain.resolver();
                    onDrain = null;
                }
            };

            writable.on("drain", drainCallback);

            const writableProxy = {
                write: (chunk: OUT): MaybePromise<void> => {
                    if (!writable.writable) {
                        return undefined;
                    }

                    const canWrite = writable.write(chunk);

                    if (!canWrite) {
                        onDrain = createResolvablePromiseObject<void>();
                        return onDrain.promise;
                    }

                    return undefined;
                },
                end: () => {
                    writable.end();
                    writable.removeListener("drain", drainCallback);
                }
            };

            this.pipes.push({ destination: writableProxy, options: options });
        }

        if (!this.isPiped) {
            this.isPiped = true;

            const onChunkCallback = async (chunk: OUT) => {
                // This is the simplest approach - wait until all pipe destinations are ready
                // again to accept incoming chunk. This also means that chunks reading speed
                // in all piped streams (both source and all destinations) will be as fast as
                // the slowest stream can accept new chunks.
                return Promise.all(this.pipes.map(pipe => pipe.destination.write(chunk))) as Promise<any>;
            };
            const onEndCallback = async () => {
                this.pipes.filter(pipe => pipe.options.end).forEach(pipe => pipe.destination.end());
            };

            (this.getReaderAsyncCallback(true, { onChunkCallback, onEndCallback }))();
        }

        return destination;
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

    @checkTransformability
    async run(): Promise<void> {
        return this.getReader(true, { onChunkCallback: () => {} })();
    }

    @checkTransformability
    async toFile(filePath: string): Promise<void> {
        const writer = createWriteStream(filePath);

        this.pipe(writer);

        return new Promise((res, rej) => {
            writer.on("finish", res);
            writer.on("error", rej);
        });
    }

    // Decorates this stream with 'on', 'once', 'emit' and 'removeListener' methods so it can be passed to native pipe
    // and returns this instance as 'Writable'. After the source is re-piped to 'StreamAsNodeWritableProxy'
    // instance, decorated methods are removed.
    asWritable(): Writable {
        return new StreamAsNodeWritableProxy(this).writable;
    }

    // Whenever native '.pipe(destination)' is called the first thing it does
    // is to call 'destination.on("unpipe", callback)'.
    // Here we catch this call and throw an error saying that '.asWritable()' method needs to be used.
    protected on(eventName: string): void {
        if (eventName === "unpipe") {
            throw new Error("Use 'stream.asWritable()' when passing this stream to a native '.pipe()' method.");
        }

        throw new Error("The '.on()' method should not be called directly.");
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
        this.pipeable = false;

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
        this.pipeable = false;

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
