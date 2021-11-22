import { IFCA } from "../ifca";
import { MaybePromise, IFCAOptions } from "../types";

export class IFCAChain<IN> {
    /**
     * All IFCA instances managed by this chain.
     */
    private chain: Array<IFCA<any, any>> = [];

    /**
     * Creates and adds new IFCA to this chain,
     *
     * @param {IFCAOptions} options IFCA options.
     * @returns {IFCA} Newly created IFCA instance.
     */
    add<NEW_IN, NEW_OUT>(options: IFCAOptions): IFCA<NEW_IN, NEW_OUT, any> {
        const ifca = new IFCA<NEW_IN, NEW_OUT, any>(options);

        this.chain.push(ifca);

        return ifca;
    }

    /**
     * Gets last IFCA instance from this chain.
     *
     * @returns {IFCA} IFCA instance.
     */
    get<NEW_IN, NEW_OUT>(): IFCA<NEW_IN, NEW_OUT, any> {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Writes to IFCA chain (to first IFCA in a chain).
     *
     * @param {IN} chunk Chunk to be written.
     * @returns {MaybePromise<void>} Drain value/promise.
     */
    write(chunk: IN): MaybePromise<void> {
        return this.chain[0].write(chunk);
    }

    /**
     * Reads from IFCA chain (from last IFCA in a chain).
     *
     * @returns {MaybePromise<OUT|null>} Promise resolving to a chunk, chunk itself or null if there is nothing to read.
     */
    read<OUT>(): MaybePromise<OUT|null> {
        return this.chain[this.chain.length - 1].read();
    }

    /**
     * Ends IFCA chain.
     *
     * @returns {MaybePromise<void>} Promise resolving (or already resolved) when chain is ended.
     */
    end(): MaybePromise<void> {
        return this.chain[0].end();
    }
}
