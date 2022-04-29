/// <reference types="node" />
import EventEmitter from "events";
import { Writable } from "stream";
import { BaseStream } from "../base-stream";
export declare class StreamAsNodeWritableProxy<IN, OUT> extends EventEmitter {
    protected instance: BaseStream<IN, OUT>;
    constructor(instance: BaseStream<IN, OUT>);
    protected isPiped: boolean;
    protected orgOn?: Function;
    get writable(): Writable;
    write(chunk: IN): boolean;
    end(): Writable;
    protected attachListeners(): void;
    protected detachListeners(): void;
    protected getEmitProxy(): (eventName: string, ...args: any[]) => boolean;
}
