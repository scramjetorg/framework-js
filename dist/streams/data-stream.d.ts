/// <reference types="node" />
import { Readable, Writable } from "stream";
import { BaseStream } from "./base-stream";
import { IFCA } from "../ifca";
import { IFCAChain } from "../ifca/ifca-chain";
import { AnyIterable, StreamConstructor, ResolvablePromiseObject, TransformFunction, MaybePromise, StreamOptions } from "../types";
declare type Reducer<IN, OUT> = {
    isAsync: boolean;
    value?: OUT;
    onFirstChunkCallback: Function;
    onChunkCallback: (chunk: IN) => MaybePromise<void>;
};
declare type WritableProxy<IN> = {
    write: (chunk: IN) => MaybePromise<void>;
    end: () => void;
};
declare type Pipe<IN> = {
    destination: BaseStream<IN, any> | WritableProxy<IN>;
    options: {
        end: boolean;
    };
};
export declare class DataStream<IN, OUT = IN> implements BaseStream<IN, OUT>, AsyncIterable<OUT> {
    protected options: StreamOptions;
    protected parentStream?: DataStream<IN, any> | undefined;
    constructor(options?: StreamOptions, parentStream?: DataStream<IN, any> | undefined);
    protected corked: ResolvablePromiseObject<void> | null;
    protected ifcaChain: IFCAChain<IN>;
    protected ifca: IFCA<IN | OUT, OUT, any>;
    protected pipes: Array<Pipe<OUT>>;
    protected writable: boolean;
    protected readable: boolean;
    protected transformable: boolean;
    protected pipeable: boolean;
    protected isPiped: boolean;
    static from<IN extends any, STREAM extends DataStream<IN>>(this: StreamConstructor<STREAM>, input: Iterable<IN> | AsyncIterable<IN> | Readable, options?: StreamOptions): STREAM;
    static fromFile<IN extends any, STREAM extends DataStream<IN>>(this: StreamConstructor<STREAM>, path: string, options?: StreamOptions): STREAM;
    [Symbol.asyncIterator](): {
        next: () => Promise<IteratorYieldResult<OUT> | IteratorReturnResult<boolean>>;
    };
    write(chunk: IN): MaybePromise<void>;
    read(): MaybePromise<OUT | null>;
    pause(): void;
    resume(): void;
    end(): MaybePromise<void>;
    each<ARGS extends any[] = []>(callback: TransformFunction<OUT, void, ARGS>, ...args: ARGS): DataStream<IN, OUT>;
    map<ARGS extends any[] = []>(callback: TransformFunction<OUT, IN, ARGS>, ...args: ARGS): DataStream<IN>;
    map<NEW_OUT, ARGS extends any[] = []>(callback: TransformFunction<OUT, NEW_OUT, ARGS>, ...args: ARGS): DataStream<IN, NEW_OUT>;
    filter<ARGS extends any[] = []>(callback: TransformFunction<OUT, Boolean, ARGS>, ...args: ARGS): DataStream<IN, OUT>;
    batch<ARGS extends any[] = []>(callback: TransformFunction<OUT, Boolean, ARGS>, ...args: ARGS): DataStream<IN, OUT[]>;
    flatMap<ARGS extends any[] = []>(callback: TransformFunction<OUT, AnyIterable<IN>, ARGS>, ...args: ARGS): DataStream<IN>;
    flatMap<NEW_OUT, ARGS extends any[] = []>(callback: TransformFunction<OUT, AnyIterable<NEW_OUT>, ARGS>, ...args: ARGS): DataStream<IN, NEW_OUT>;
    pipe<DEST extends BaseStream<OUT, any>>(destination: DEST, options?: {
        end: boolean;
    }): DEST;
    pipe<DEST extends Writable>(destination: DEST, options?: {
        end: boolean;
    }): DEST;
    use<NEW_OUT>(callback: (stream: DataStream<IN, OUT>) => NEW_OUT): NEW_OUT;
    reduce<NEW_OUT = OUT>(callback: (previousValue: NEW_OUT, currentChunk: OUT) => MaybePromise<NEW_OUT>, initial?: NEW_OUT): Promise<NEW_OUT>;
    toArray(): Promise<OUT[]>;
    run(): Promise<void>;
    toFile(filePath: string): Promise<void>;
    asWritable(): Writable;
    protected on(eventName: string): void;
    protected createChildStream(): DataStream<IN, OUT>;
    protected createChildStream<NEW_OUT>(): DataStream<IN, NEW_OUT>;
    protected createChildStreamSuperType<NEW_OUT>(): DataStream<IN, NEW_OUT>;
    protected cork(): void;
    protected uncork(): void;
    protected getReducer<NEW_OUT>(callback: (previousValue: NEW_OUT, currentChunk: OUT) => MaybePromise<NEW_OUT>, initial?: NEW_OUT): Reducer<OUT, NEW_OUT>;
    protected getReader(uncork: boolean, callbacks: {
        onChunkCallback: (chunk: OUT) => void;
        onFirstChunkCallback?: Function;
        onEndCallback?: Function;
    }): () => Promise<void>;
    protected getReaderAsyncCallback(uncork: boolean, callbacks: {
        onChunkCallback: (chunk: OUT) => MaybePromise<void>;
        onFirstChunkCallback?: Function;
        onEndCallback?: Function;
    }): () => Promise<void>;
    protected readSource(iterable: Iterable<IN> | AsyncIterable<IN>): this;
    protected injectArgsToCallback<NEW_OUT, ARGS extends any[]>(callback: TransformFunction<OUT, NEW_OUT, ARGS>, args: ARGS): (chunk: OUT) => Promise<NEW_OUT> | NEW_OUT;
    protected injectArgsToCallbackAndMapResult<NEW_OUT, MAP_TO, ARGS extends any[]>(callback: TransformFunction<OUT, NEW_OUT, ARGS>, resultMapper: (chunk: OUT, result: NEW_OUT) => MAP_TO, args: ARGS): (chunk: OUT) => Promise<MAP_TO> | MAP_TO;
}
export {};
