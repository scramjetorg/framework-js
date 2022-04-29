import { MaybePromise } from "../types";
export declare class ProcessingQueue<TYPE> {
    constructor(whenEmitted: () => void);
    id: string;
    private _ready;
    private _requested;
    private _pendingLength;
    private _hasEnded;
    private previousChunk;
    private whenEmitted;
    get length(): number;
    get pendingLength(): number;
    get last(): Promise<TYPE | void>;
    push(chunkResolver: Promise<TYPE>): void;
    read(): MaybePromise<TYPE | null>;
    close(): void;
    private resolveAwaitingRequests;
}
