import { IFCA } from "../ifca";
import { MaybePromise, IFCAOptions } from "../types";
export declare class IFCAChain<IN> {
    private chain;
    get length(): number;
    create<NEW_IN, NEW_OUT>(options: IFCAOptions): IFCA<NEW_IN, NEW_OUT, any>;
    add<NEW_IN, NEW_OUT>(ifca: IFCA<NEW_IN, NEW_OUT, any>): void;
    get<NEW_IN, NEW_OUT>(): IFCA<NEW_IN, NEW_OUT, any>;
    write(chunk: IN): MaybePromise<void>;
    read<OUT>(): MaybePromise<OUT | null>;
    end(): MaybePromise<void>;
}
