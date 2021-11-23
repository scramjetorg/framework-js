import { DroppedChunk, MaybePromise } from "../types";
import { createResolvablePromiseObject, getId } from "../utils";

export class ProcessingQueue<TYPE> {
    /**
     * Creates instance of ProcessingQueue.
     *
     * @param {Function} whenEmitted Callback function called each time any chunk leaves the queue.
     */
    constructor(whenEmitted: () => void) {
        this.whenEmitted = whenEmitted;
    }

    /**
     * Instance unique id.
     */
    public id = getId("IFCA:ProcessingQueue");

    /**
     * Ready chunks waitng to be read.
     */
    private _ready: TYPE[] = [];

    /**
     * Awaitng chunk requests.
     */
    private _requested: Object[] = [];

    /**
     * Number of chunks processed at the given moment.
     */
    private _pendingLength: number = 0;

    /**
     * Whenever the queue is closed.
     */
    private _hasEnded: Boolean = false;

    /**
     * Last chunk which was pushed to the queue.
     */
    private previousChunk: Promise<TYPE | void> = Promise.resolve();

    /**
     * Callback function called each time any chunk leaves the queue.
     */
    private whenEmitted: () => void;

    /**
     * @returns {number} Number of chunks (both being processed and ready) in the queue at the given moment.
     */
    get length(): number {
        return this._pendingLength + this._ready.length;
    }

    /**
     * @returns {number} Number of chunks processed at the given moment.
     */
    get pendingLength(): number {
        return this._pendingLength;
    }

    /**
     * Last chunk which was pushed to the queue.
     * If there were no chunks pushed, resolved promise is returned.
     *
     * @returns {Promise<TYPE|void>} Last chunk from the queue.
     */
    get last(): Promise<TYPE|void> {
        return this.previousChunk;
    }

    /**
     * Adds chunk promise to the queue.
     *
     * @param {Promise<TYPE>} chunkResolver Promise resolving to a chunk.
     * @returns {void}
     */
    push(chunkResolver: Promise<TYPE>): void {
        // We don't need to worry about chunks resolving order since it is guaranteed
        // by IFCA with Promise.all[previousChunk, currentChunk].
        chunkResolver.then((result: TYPE) => {
            this._pendingLength--;

            if (result as any !== DroppedChunk) {
                this._ready.push(result);

                // If there is any chunk requested (read awaiting) resolve it.
                if (this._requested.length) {
                    const chunkRequest: any = this._requested.shift();

                    chunkRequest.resolver(this._ready.shift() as TYPE);

                    this.whenEmitted();
                }
            } else {
                // Dropped chunks also means queue length changes.
                this.whenEmitted();
            }

            // If queue is closed and there are no more pending items we need to make sure
            // to resolve all waiting chunks requests (with nulls since there is no more data).
            if (this._hasEnded) {
                this.resolveAwaitingRequests();
            }
        });

        this._pendingLength++;

        this.previousChunk = chunkResolver;
    }

    /**
     * Reads chunk from the queue.
     *
     * If there are ready chunks waiting, value is returned. If not, a promise
     * which will resolved upon next chunk processing completes is returned.
     *
     * If the queue is closed and no more data avaialbe, `null`s are retruned.
     *
     * @returns {MaybePromise<TYPE|null>} Promise resolving to a chunk or chunk.
     */
    read(): MaybePromise<TYPE|null> {
        // If chunk is ready, simply return it.
        if (this._ready.length) {
            // TODO handle nulls?

            const chunk = this._ready.shift() as TYPE;

            this.whenEmitted();

            return chunk;
        }

        // Add chunk request to a queue if:
        // * queue is not closed and there are no ready chunks
        // * queue is closed but there are still pending chunks
        if (!this._hasEnded || this._hasEnded && this._pendingLength > 0) {
            const chunkRequest = createResolvablePromiseObject();

            this._requested.push(chunkRequest);

            return chunkRequest.promise as Promise<TYPE>;
        }

        return null;
    }

    /**
     * Closes the queue and resolves all awaiting chunk requests.
     *
     * @returns {void}
     */
    close() {
        this._hasEnded = true;
        this.resolveAwaitingRequests();
    }

    /**
     * Resolves all awaiting chunk requests which cannot be resolved due to end of data.
     *
     * @returns {void}
     */
    private resolveAwaitingRequests() {
        if (this._hasEnded && this._pendingLength === 0 && this._requested.length > 0) {
            for (const chunkRequest of this._requested) {
                (chunkRequest as any).resolver(null);
            }
        }
    }
}
