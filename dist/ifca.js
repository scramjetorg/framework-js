"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFCA = void 0;
const os_1 = require("os");
const types_1 = require("./types");
const utils_1 = require("./utils");
const processing_queue_1 = require("./ifca/processing-queue");
class IFCA {
    constructor(options) {
        this.id = (0, utils_1.getId)("IFCA:IFCA");
        this.transformHandlers = [];
        this.processingQueue = new processing_queue_1.ProcessingQueue(this.getDrainResolver());
        this.ended = false;
        this.drain = undefined;
        this.maxParallel = options.maxParallel === undefined ? 2 * (0, os_1.cpus)().length : options.maxParallel;
        this.strict = options.strict === undefined ? true : !!options.strict;
        this.ordered = options.ordered === undefined ? true : !!options.ordered;
    }
    get state() {
        return {
            id: this.id,
            all: this.processingQueue.length,
            pending: this.processingQueue.pendingLength,
            maxParallel: this.maxParallel,
            strict: this.strict,
            ordered: this.ordered
        };
    }
    write(_chunk) {
        (0, utils_1.trace)("IFCA-WRITE_TRY", _chunk, this.state);
        if (this.ended)
            throw new Error("Write after end");
        if (_chunk === null)
            return this.end();
        (0, utils_1.trace)("IFCA-WRITE", _chunk, this.state);
        const chunkBeforeThisOne = this.processingQueue.last;
        const currentChunkResult = this.strict
            ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);
        this.processingQueue.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult));
        if (this.processingQueue.length >= this.maxParallel && this.drain === undefined) {
            this.drain = (0, utils_1.createResolvablePromiseObject)();
        }
        (0, utils_1.trace)("DRAIN WRITE:", this.drain);
        return this.drain ? this.drain.promise : undefined;
    }
    writev(_chunks) {
        if (this.ended)
            throw new Error("Write after end");
        const chunksToBeProcessed = (_chunks.indexOf(null) >= 0
            ? _chunks.slice(0, _chunks.indexOf(null)) : _chunks);
        chunksToBeProcessed.forEach(_chunk => {
            const chunkBeforeThisOne = this.processingQueue.last;
            const currentChunkResult = this.strict
                ? this.makeStrictTransformChain(_chunk) : this.makeTransformChain(_chunk);
            this.processingQueue.push(this.makeProcessingItem(chunkBeforeThisOne, currentChunkResult));
        });
        if (this.processingQueue.length >= this.maxParallel && this.drain === undefined) {
            this.drain = (0, utils_1.createResolvablePromiseObject)();
        }
        (0, utils_1.trace)("DRAIN WRITE:", this.drain);
        return this.drain ? this.drain.promise : undefined;
    }
    makeTransformChain(_chunk) {
        const transforms = this.transformHandlers;
        return this.chainAsynchronousTransforms(transforms, _chunk)(_chunk);
    }
    makeStrictTransformChain(_chunk) {
        const funcs = [...this.transformHandlers];
        let value = _chunk;
        let transforms = [];
        let isPrevFuncSync = true;
        while (funcs.length) {
            const func = funcs.shift();
            const isFuncSync = !(0, utils_1.isAsyncTransformHandler)(func);
            if (transforms.length && isFuncSync !== isPrevFuncSync) {
                value = this.mergeTransformChains(value, transforms, _chunk, isPrevFuncSync);
                transforms = [];
            }
            if (value === types_1.DroppedChunk) {
                transforms = [];
                break;
            }
            transforms.push(func);
            isPrevFuncSync = isFuncSync;
        }
        if (transforms.length) {
            value = this.mergeTransformChains(value, transforms, _chunk, isPrevFuncSync);
        }
        return value;
    }
    mergeTransformChains(transformChain, transforms, initialChunk, synchronous) {
        const isPromise = transformChain instanceof Promise;
        if (synchronous) {
            return isPromise ? transformChain.then(this.chainSynchronousTransforms(transforms, initialChunk))
                : this.chainSynchronousTransforms(transforms, initialChunk)(transformChain);
        }
        return Promise.resolve(transformChain).then(this.chainAsynchronousTransforms(transforms, initialChunk));
    }
    makeProcessingItem(chunkBeforeThisOne, currentChunkResult) {
        return Promise.all([
            chunkBeforeThisOne && chunkBeforeThisOne.finally(),
            this.attachErrorHandlerToChunkResult(currentChunkResult)
        ])
            .then(([, result]) => {
            return result;
        })
            .catch(e => {
            if (typeof e !== "undefined") {
                throw e;
            }
        });
    }
    attachErrorHandlerToChunkResult(currentChunkResult) {
        if (currentChunkResult instanceof Promise) {
            currentChunkResult.catch((err) => {
                if (err) {
                    throw err;
                }
            });
        }
        return currentChunkResult;
    }
    chainSynchronousTransforms(funcs, processingChunk) {
        return (a) => {
            let value = a;
            for (const [executor, handler] of funcs) {
                try {
                    if (executor) {
                        value = executor(value);
                    }
                    if (value === types_1.DroppedChunk) {
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
    chainAsynchronousTransforms(funcs, processingChunk) {
        return async (a) => {
            let value = await a;
            for (const [executor, handler] of funcs) {
                try {
                    if (executor) {
                        value = await executor(value);
                    }
                    if (value === types_1.DroppedChunk) {
                        break;
                    }
                }
                catch (err) {
                    if (typeof err === "undefined") {
                        value = await Promise.reject(undefined);
                    }
                    else if (handler) {
                        value = await handler(err, processingChunk);
                    }
                    else {
                        throw err;
                    }
                }
            }
            return value;
        };
    }
    getDrainResolver() {
        return () => {
            (0, utils_1.trace)("IFCA ON-CHUNK-RESOLVED", this.processingQueue.length, this.maxParallel, this.drain, this.id);
            if (this.processingQueue.length < this.maxParallel && this.drain !== undefined) {
                this.drain.resolver();
                this.drain = undefined;
            }
        };
    }
    end() {
        if (this.ended) {
            throw new Error("End called multiple times");
        }
        (0, utils_1.trace)("ENDING IFCA", this.state);
        this.processingQueue.close();
        this.ended = true;
        if (this.processingQueue.pendingLength > 0) {
            return this.processingQueue.last.then();
        }
        return undefined;
    }
    read() {
        return this.processingQueue.read();
    }
    addErrorHandler(handler) {
        this.transformHandlers.push([undefined, handler]);
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
}
exports.IFCA = IFCA;
//# sourceMappingURL=ifca.js.map