import EventEmitter from "events";
import { Writable } from "stream";
import { BaseStream } from "./base-stream";

export class WritableNodeProxy<IN, OUT> extends EventEmitter {

    constructor(
        protected instance: BaseStream<IN, OUT>
    ) {
        super();
    }

    public asPipe: boolean = false;

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
}
