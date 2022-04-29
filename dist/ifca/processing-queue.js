"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingQueue = void 0;
const types_1 = require("../types");
const utils_1 = require("../utils");
class ProcessingQueue {
    constructor(whenEmitted) {
        this.id = (0, utils_1.getId)("IFCA:ProcessingQueue");
        this._ready = [];
        this._requested = [];
        this._pendingLength = 0;
        this._hasEnded = false;
        this.previousChunk = Promise.resolve();
        this.whenEmitted = whenEmitted;
    }
    get length() {
        return this._pendingLength + this._ready.length;
    }
    get pendingLength() {
        return this._pendingLength;
    }
    get last() {
        return this.previousChunk;
    }
    push(chunkResolver) {
        chunkResolver.then((result) => {
            this._pendingLength--;
            if (result !== types_1.DroppedChunk) {
                this._ready.push(result);
                if (this._requested.length) {
                    const chunkRequest = this._requested.shift();
                    chunkRequest.resolver(this._ready.shift());
                    this.whenEmitted();
                }
            }
            else {
                this.whenEmitted();
            }
            if (this._hasEnded) {
                this.resolveAwaitingRequests();
            }
        });
        this._pendingLength++;
        this.previousChunk = chunkResolver;
    }
    read() {
        if (this._ready.length) {
            const chunk = this._ready.shift();
            this.whenEmitted();
            return chunk;
        }
        if (!this._hasEnded || this._hasEnded && this._pendingLength > 0) {
            const chunkRequest = (0, utils_1.createResolvablePromiseObject)();
            this._requested.push(chunkRequest);
            return chunkRequest.promise;
        }
        return null;
    }
    close() {
        this._hasEnded = true;
        this.resolveAwaitingRequests();
    }
    resolveAwaitingRequests() {
        if (this._hasEnded && this._pendingLength === 0 && this._requested.length > 0) {
            for (const chunkRequest of this._requested) {
                chunkRequest.resolver(null);
            }
        }
    }
}
exports.ProcessingQueue = ProcessingQueue;
//# sourceMappingURL=processing-queue.js.map