"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFCA = exports.DroppedChunk = void 0;
const os_1 = require("os");
const utils_1 = require("../utils");
exports.DroppedChunk = Symbol("DroppedChunk");
const isAsync = (func) => func.length && (func[0] && func[0][Symbol.toStringTag] === 'AsyncFunction' ||
    func[1] && func[1][Symbol.toStringTag] === 'AsyncFunction');
class IFCA {
    constructor(maxParallel = 2 * (0, os_1.cpus)().length, initialTransform, options = {}) {
        this.maxParallel = maxParallel;
        this.transformHandlers = [];
        this.processing = [];
        this.readable = [];
        this.readers = [];
        this.ended = false;
        this.endedPromise = null;
        this.endedPromiseResolver = null;
        this.processingQueue = new ProcessingQueue();
        this.transformHandlers.push([initialTransform]);
        this.strict = !!options.strict;
    }
    get status() {
        return "R,".repeat(this.readers.length) + this.processing.slice(this.readers.length).map((x, i) => this.readable[this.readers.length + i] ? 'd,' : 'p,');
    }
    write(_chunk) {
        if (this.ended)
            throw new Error("Write after end");
        if (_chunk === null)
            return this.end();
        const pendingLength = this.processingQueue.length;
        (0, utils_1.trace)('IFCA WRITE pos: ', pendingLength, _chunk);
        const drain = pendingLength < this.maxParallel
            ? undefined
            : this.processingQueue.get(pendingLength - this.maxParallel).finally();
        const chunkBeforeThisOne = this.processingQueue.last;
        const currentChunkResult = this.strict ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);
        this.processingQueue.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult));
        (0, utils_1.trace)('DRAIN WRITE:', drain);
        return drain;
    }
    writev(_chunks) {
        if (this.ended)
            throw new Error("Write after end");
        const pos = this.processing.length;
        (0, utils_1.trace)('IFCA WRITEV pos:', pos, _chunks);
        const drain = pos < this.maxParallel
            ? undefined
            : this.processing[pos - this.maxParallel];
        const chunkBeforeThisOne = this.processing[pos - 1];
        const chunksToBeProcessed = (_chunks.indexOf(null) >= 0
            ? _chunks.slice(0, _chunks.indexOf(null)) : _chunks);
        const currentChunksResult = chunksToBeProcessed.map(chunk => this.strict ? this.makeStrictTransformChain(chunk) : this.makeTransformChain(chunk));
        this.processing.push(...this.makeProcessingItems(chunkBeforeThisOne, currentChunksResult));
        (0, utils_1.trace)('DRAIN WRITEV:');
        (0, utils_1.trace)(drain);
        if (chunksToBeProcessed !== _chunks)
            return drain ? drain.then(() => this.end()) : this.end();
        return drain;
    }
    makeProcessingItems(chunkBeforeThisOne, currentChunksResult) {
        const result = [];
        result.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunksResult[0]));
        for (let i = 1; i < currentChunksResult.length; i++) {
            result.push(this.makeProcessingItem(currentChunksResult[i - 1], currentChunksResult[i]));
        }
        return result;
    }
    makeProcessingItem(chunkBeforeThisOne, currentChunkResult) {
        return Promise.all([
            chunkBeforeThisOne === null || chunkBeforeThisOne === void 0 ? void 0 : chunkBeforeThisOne.finally(),
            this.attachErrorHandlerToChunkResult(currentChunkResult)
        ])
            .then(([, result]) => {
            if (result !== undefined) {
                (0, utils_1.trace)('IFCA-WRITE_RESULT', result);
                return result;
            }
            else {
                (0, utils_1.trace)("IFCA-WRITE_PROCESSING_UNDEFINED");
            }
        })
            .catch(e => {
            if (typeof e === "undefined")
                return;
            throw e;
        });
    }
    attachErrorHandlerToChunkResult(currentChunkResult) {
        if (currentChunkResult instanceof Promise) {
            currentChunkResult.catch((err) => {
                if (!err) {
                    return;
                }
                if (this.readers.length) {
                    const res = this.readers[0];
                    if (res[1]) {
                        this.readers.shift();
                        return res[1](err);
                    }
                }
                throw err;
            });
        }
        return currentChunkResult;
    }
    makeStrictTransformChain(_chunk) {
        (0, utils_1.trace)('IFCA makeStrictTransformChain');
        let funcs = [...this.transformHandlers];
        if (!funcs.length)
            return _chunk;
        let value = _chunk;
        const firstAsyncFunctions = funcs.findIndex(isAsync);
        if (firstAsyncFunctions === -1) {
            return this.makeSynchronousChain(funcs, _chunk)(value);
        }
        if (firstAsyncFunctions > 0) {
            value = this.makeSynchronousChain(funcs.slice(0, firstAsyncFunctions), _chunk)(value);
            funcs = funcs.slice(firstAsyncFunctions);
        }
        let next = Promise.resolve(value);
        while (funcs.length) {
            const handler = funcs.shift();
            next = next.then(...handler);
            const syncFunctions = funcs.findIndex(isAsync);
            if (syncFunctions > 0) {
                next = next.then(this.makeSynchronousChain(funcs.slice(0, syncFunctions), _chunk));
                funcs = funcs.slice(syncFunctions);
            }
        }
        return next;
    }
    makeSynchronousChain(funcs, processingChunk) {
        return () => {
            let value = processingChunk;
            (0, utils_1.trace)('IFCA makeSynchronousChain');
            for (const [executor, handler] of funcs) {
                try {
                    if (executor) {
                        value = executor(value);
                    }
                    console.log("MSC", value);
                    if (value === exports.DroppedChunk) {
                        console.log('DROPPED-CHUNK');
                        break;
                    }
                }
                catch (err) {
                    if (typeof err !== "undefined") {
                        if (handler) {
                            value = handler(err, processingChunk);
                        }
                        else {
                            throw err;
                        }
                    }
                    else {
                        value = undefined;
                    }
                }
            }
            return value;
        };
    }
    makeTransformChain(_chunk) {
        let ret = this.transformHandlers
            .reduce((prev, [_executor, _handler]) => {
            if (!_handler)
                return prev.then(_executor === null || _executor === void 0 ? void 0 : _executor.bind(this));
            const handler = (err, chunk) => {
                if (typeof err === "undefined")
                    return Promise.reject(undefined);
                return _handler.bind(this)(err, chunk);
            };
            if (!_executor && handler)
                return prev.catch(handler);
            return prev.then(_executor === null || _executor === void 0 ? void 0 : _executor.bind(this), handler);
        }, Promise.resolve(_chunk));
        return ret;
    }
    end() {
        if (this.ended) {
            throw new Error("End called multiple times");
        }
        this.processingQueue.close();
        this.ended = true;
        if (this.processingQueue.length > 0) {
            return Promise.all(this.processingQueue.all).then(() => { this.handleEnd(); });
        }
        this.handleEnd();
    }
    handleEnd() {
        (0, utils_1.trace)("IFCA-HANDLE_END()");
        if (this.endedPromiseResolver) {
            this.endedPromiseResolver();
        }
        return null;
    }
    read() {
        (0, utils_1.trace)('IFCA-READ() processing');
        const result = this.processingQueue.read();
        if (result) {
            return result;
        }
        else if (!result && this.ended) {
            (0, utils_1.trace)('IFCA-READ ENDED', result);
            return null;
        }
        (0, utils_1.trace)('IFCA-READ CREATE_READER');
        return new Promise((...handlers) => {
            (0, utils_1.trace)('IFCA-READ INSIDE PROMISE');
            (0, utils_1.trace)('READERS', this.readers);
            return this.readers.push(handlers);
        });
    }
    addErrorHandler(handler) {
        this.transformHandlers.push([, handler]);
        return this;
    }
    addTransform(transform, handler) {
        this.transformHandlers.push([transform, handler]);
        return this;
    }
    removeTransform() {
        this.transformHandlers.shift();
        return this;
    }
    whenEnded() {
        if (!this.endedPromise) {
            this.endedPromise = new Promise(res => {
                this.endedPromiseResolver = res;
            });
        }
        return this.endedPromise;
    }
}
exports.IFCA = IFCA;
class ProcessingQueue {
    constructor() {
        this.hasStarted = false;
        this.hasEnded = false;
        this.pending = [];
        this.ready = [];
        this.requested = [];
    }
    get length() {
        return this.pending.length;
    }
    get last() {
        if (this.pending.length) {
            return this.pending[this.pending.length - 1];
        }
        if (!this.hasStarted) {
            return Promise.resolve();
        }
        return null;
    }
    get all() {
        return this.pending;
    }
    get(index) {
        return this.pending[index];
    }
    push(chunkResolver) {
        chunkResolver.then((result) => {
            this.pending.shift();
            this.ready.push(result);
            if (this.requested.length) {
                const chunkRequest = this.requested.shift();
                chunkRequest.resolver(this.ready.shift());
            }
            this.hasEnded && this.resolveAwaitingRequests();
        });
        this.hasStarted = true;
        this.pending.push(chunkResolver);
    }
    read() {
        if (this.ready.length) {
            return this.ready.shift();
        }
        if (!this.hasEnded) {
            const chunkRequest = this.createChunkRequest();
            this.requested.push(chunkRequest);
            return chunkRequest.promise;
        }
        if (this.hasEnded && this.pending.length > 0) {
            const chunkRequest = this.createChunkRequest();
            this.requested.push(chunkRequest);
            return chunkRequest.promise;
        }
        return null;
    }
    close() {
        this.hasEnded = true;
        this.resolveAwaitingRequests();
    }
    createChunkRequest() {
        let resolver = undefined;
        const promise = new Promise(res => {
            resolver = res;
        });
        return { promise, resolver };
    }
    resolveAwaitingRequests() {
        if (this.hasEnded && this.pending.length === 0 && this.requested.length > 0) {
            for (const chunkRequest of this.requested) {
                chunkRequest.resolver(null);
            }
        }
    }
}
