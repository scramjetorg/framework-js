import EventEmitter from "events";
import { Readable, Writable } from "stream";
import { BaseStream } from "../base-stream";

export class StreamAsNodeWritableProxy<IN, OUT> extends EventEmitter {

    constructor(
        protected instance: BaseStream<IN, OUT>
    ) {
        super();

        this.attachListeners();
    }

    protected isPiped: boolean = false;
    protected orgOn?: Function;

    get writable(): Writable {
        return this.instance as any as Writable;
    }

    write(chunk: IN): boolean {
        const drain = this.instance.write(chunk);

        if (drain instanceof Promise) {
            drain.then(() => {
                this.emit("drain");
            });

            return false;
        }

        return true;
    }

    end(): Writable {
        this.instance.end();

        return this as any as Writable;
    }

    protected attachListeners(): void {
        const stream = this.instance as any;

        this.orgOn = stream.on;

        stream.on = (eventName: string, listener: (...args: any[]) => void): BaseStream<IN, OUT> => {
            this.on(eventName, listener);

            return this.instance;
        };

        stream.once = (eventName: string, listener: (...args: any[]) => void): BaseStream<IN, OUT> => {
            this.once(eventName, listener);

            return this.instance;
        };

        stream.removeListener = (eventName: string, listener: (...args: any[]) => void): BaseStream<IN, OUT> => {
            this.removeListener(eventName, listener);

            return this.instance;
        };

        stream.emit = this.getEmitProxy();
    }

    protected detachListeners(): void {
        const stream = this.instance as any;

        stream.on = this.orgOn;
        stream.once = undefined;
        stream.removeListener = undefined;
        stream.emit = undefined;
    }

    protected getEmitProxy() {
        return (eventName: string, ...args: any[]): boolean => {
            const hasListeners = this.emit(eventName, ...args);
            const source = args[0] as Readable;
            const oldDest = this.instance as any as Writable;
            const newDest = this as any as Writable;

            if (eventName === "pipe") {
                source.unpipe(oldDest);
            } else if (eventName === "unpipe") {
                this.isPiped = true;

                source.pipe(newDest);

                this.detachListeners();

                const unpipe = source.unpipe;

                (source as any).unpipe = (...args1: any[]) => {
                    if (args1[0] === oldDest) {
                        args1[0] = newDest;
                    }

                    const cleanup = args1.length === 0 || args1[0] === newDest;

                    unpipe.call(source, ...args1);

                    if (cleanup) {
                        source.unpipe = unpipe;
                    }
                };
            }

            return hasListeners;
        };
    }
}
