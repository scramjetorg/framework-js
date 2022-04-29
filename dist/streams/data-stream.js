"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStream = void 0;
const fs_1 = require("fs");
const ifca_chain_1 = require("../ifca/ifca-chain");
const utils_1 = require("../utils");
const types_1 = require("../types");
const decorators_1 = require("../decorators");
const stream_node_writable_proxy_1 = require("./proxies/stream-node-writable-proxy");
class DataStream {
    constructor(options = { maxParallel: 4 }, parentStream) {
        this.options = options;
        this.parentStream = parentStream;
        this.corked = (0, utils_1.createResolvablePromiseObject)();
        this.writable = true;
        this.readable = true;
        this.transformable = true;
        this.pipeable = true;
        this.isPiped = false;
        if (!this.parentStream) {
            this.ifcaChain = new ifca_chain_1.IFCAChain();
            this.ifca = this.ifcaChain.create(options);
            this.pipes = [];
        }
        else {
            this.ifcaChain = this.parentStream.ifcaChain;
            this.ifca = this.ifcaChain.get();
            this.pipes = this.parentStream.pipes;
        }
    }
    static from(input, options) {
        return (new this(options)).readSource(input);
    }
    static fromFile(path, options) {
        return (new this(options)).readSource((0, fs_1.createReadStream)(path, options && options.readStream));
    }
    [Symbol.asyncIterator]() {
        if (!this.readable) {
            throw new Error("Stream is not readable.");
        }
        this.uncork();
        return {
            next: async () => {
                const value = await this.ifca.read();
                return Promise.resolve({ value, done: value === null });
            }
        };
    }
    write(chunk) {
        this.uncork();
        return this.ifcaChain.write(chunk);
    }
    read() {
        if (!this.readable) {
            throw new Error("Stream is not readable.");
        }
        this.uncork();
        return this.ifcaChain.read();
    }
    pause() {
        this.cork();
    }
    resume() {
        this.uncork();
    }
    end() {
        return this.ifcaChain.end();
    }
    each(callback, ...args) {
        const eachCallback = (0, utils_1.isAsyncFunction)(callback)
            ? async (chunk) => { await callback(chunk, ...args); return chunk; }
            : (chunk) => { callback(chunk, ...args); return chunk; };
        this.ifcaChain.add(this.ifca.addTransform(eachCallback));
        return this.createChildStream();
    }
    map(callback, ...args) {
        if (args && args.length) {
            this.ifcaChain.add(this.ifca.addTransform(this.injectArgsToCallback(callback, args)));
        }
        else {
            this.ifcaChain.add(this.ifca.addTransform(callback));
        }
        return this.createChildStream();
    }
    filter(callback, ...args) {
        const chunksFilter = (chunk, result) => result ? chunk : types_1.DroppedChunk;
        const ifca = this.ifca.addTransform(this.injectArgsToCallbackAndMapResult(callback, chunksFilter, args));
        this.ifcaChain.add(ifca);
        return this.createChildStream();
    }
    batch(callback, ...args) {
        let currentBatch = [];
        this.ifcaChain.create(this.options);
        const newStream = this.createChildStreamSuperType();
        const callbacks = {
            onChunkCallback: async (chunk) => {
                const emitBatch = await callback(chunk, ...args);
                currentBatch.push(chunk);
                if (emitBatch) {
                    await newStream.ifca.write([...currentBatch]);
                    currentBatch = [];
                }
            },
            onEndCallback: async () => {
                if (currentBatch.length > 0) {
                    await newStream.ifca.write(currentBatch);
                }
                newStream.ifca.end();
            }
        };
        (this.getReaderAsyncCallback(false, callbacks))();
        return newStream;
    }
    flatMap(callback, ...args) {
        this.ifcaChain.create(this.options);
        const newStream = this.createChildStream();
        const callbacks = {
            onChunkCallback: async (chunk) => {
                var e_1, _a;
                const items = await callback(chunk, ...args);
                {
                    try {
                        for (var items_1 = __asyncValues(items), items_1_1; items_1_1 = await items_1.next(), !items_1_1.done;) {
                            const item = items_1_1.value;
                            await newStream.ifca.write(item);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (items_1_1 && !items_1_1.done && (_a = items_1.return)) await _a.call(items_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                }
            },
            onEndCallback: async () => {
                newStream.ifca.end();
            }
        };
        (this.getReaderAsyncCallback(false, callbacks))();
        return newStream;
    }
    pipe(destination, options = { end: true }) {
        if (!this.pipeable) {
            throw new Error("Stream is not pipeable.");
        }
        this.transformable = false;
        if (destination.ifca) {
            this.pipes.push({ destination: destination, options: options });
        }
        else {
            let onDrain = null;
            const writable = destination;
            const drainCallback = () => {
                if (onDrain) {
                    onDrain.resolver();
                    onDrain = null;
                }
            };
            writable.on("drain", drainCallback);
            const writableProxy = {
                write: (chunk) => {
                    if (!writable.writable) {
                        return undefined;
                    }
                    const canWrite = writable.write(chunk);
                    if (!canWrite) {
                        onDrain = (0, utils_1.createResolvablePromiseObject)();
                        return onDrain.promise;
                    }
                    return undefined;
                },
                end: () => {
                    writable.end();
                    writable.removeListener("drain", drainCallback);
                }
            };
            this.pipes.push({ destination: writableProxy, options: options });
        }
        if (!this.isPiped) {
            this.isPiped = true;
            const onChunkCallback = async (chunk) => {
                return Promise.all(this.pipes.map(pipe => pipe.destination.write(chunk)));
            };
            const onEndCallback = async () => {
                this.pipes.filter(pipe => pipe.options.end).forEach(pipe => pipe.destination.end());
            };
            (this.getReaderAsyncCallback(true, { onChunkCallback, onEndCallback }))();
        }
        return destination;
    }
    use(callback) {
        return callback(this);
    }
    async reduce(callback, initial) {
        const reducer = this.getReducer(callback, initial);
        const reader = reducer.isAsync
            ? this.getReaderAsyncCallback(true, reducer)
            : this.getReader(true, reducer);
        return reader().then(() => reducer.value);
    }
    async toArray() {
        const chunks = [];
        const reader = this.getReader(true, { onChunkCallback: chunk => { chunks.push(chunk); } });
        return reader().then(() => chunks);
    }
    async run() {
        return this.getReader(true, { onChunkCallback: () => { } })();
    }
    async toFile(filePath) {
        const writer = (0, fs_1.createWriteStream)(filePath);
        this.pipe(writer);
        return new Promise((res, rej) => {
            writer.on("finish", res);
            writer.on("error", rej);
        });
    }
    asWritable() {
        return new stream_node_writable_proxy_1.StreamAsNodeWritableProxy(this).writable;
    }
    on(eventName) {
        if (eventName === "unpipe") {
            throw new Error("Use 'stream.asWritable()' when passing this stream to a native '.pipe()' method.");
        }
        throw new Error("The '.on()' method should not be called directly.");
    }
    createChildStream() {
        this.readable = false;
        this.transformable = false;
        this.pipeable = false;
        return new DataStream(this.options, this);
    }
    createChildStreamSuperType() {
        this.readable = false;
        this.transformable = false;
        this.pipeable = false;
        return new DataStream(this.options, this);
    }
    cork() {
        if (this.parentStream) {
            this.parentStream.cork();
        }
        if (this.corked === null) {
            this.corked = (0, utils_1.createResolvablePromiseObject)();
        }
    }
    uncork() {
        if (this.parentStream) {
            this.parentStream.uncork();
        }
        if (this.corked) {
            this.corked.resolver();
            this.corked = null;
        }
    }
    getReducer(callback, initial) {
        const reducer = {
            isAsync: (0, utils_1.isAsyncFunction)(callback),
            value: initial
        };
        reducer.onFirstChunkCallback = async (chunk) => {
            if (initial === undefined) {
                reducer.value = chunk;
            }
            else {
                reducer.value = await callback(reducer.value, chunk);
            }
        };
        if (reducer.isAsync) {
            reducer.onChunkCallback = async (chunk) => {
                reducer.value = await callback(reducer.value, chunk);
            };
        }
        else {
            reducer.onChunkCallback = (chunk) => {
                reducer.value = callback(reducer.value, chunk);
            };
        }
        return reducer;
    }
    getReader(uncork, callbacks) {
        return async () => {
            if (uncork && this.corked) {
                this.uncork();
            }
            let chunk = this.ifca.read();
            if (callbacks.onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }
                if (chunk !== null) {
                    await callbacks.onFirstChunkCallback(chunk);
                    chunk = this.ifca.read();
                }
            }
            while (true) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }
                if (chunk === null) {
                    break;
                }
                callbacks.onChunkCallback(chunk);
                chunk = this.ifca.read();
            }
            if (callbacks.onEndCallback) {
                await callbacks.onEndCallback.call(this);
            }
        };
    }
    getReaderAsyncCallback(uncork, callbacks) {
        return async () => {
            if (uncork && this.corked) {
                this.uncork();
            }
            let chunk = this.ifca.read();
            if (callbacks.onFirstChunkCallback) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }
                if (chunk !== null) {
                    await callbacks.onFirstChunkCallback(chunk);
                    chunk = this.ifca.read();
                }
            }
            while (true) {
                if (chunk instanceof Promise) {
                    chunk = await chunk;
                }
                if (chunk === null) {
                    break;
                }
                await callbacks.onChunkCallback(chunk);
                chunk = this.ifca.read();
            }
            if (callbacks.onEndCallback) {
                await callbacks.onEndCallback.call(this);
            }
        };
    }
    readSource(iterable) {
        (async () => {
            var e_2, _a;
            if (this.corked) {
                await this.corked.promise;
            }
            {
                try {
                    for (var iterable_1 = __asyncValues(iterable), iterable_1_1; iterable_1_1 = await iterable_1.next(), !iterable_1_1.done;) {
                        const data = iterable_1_1.value;
                        if (this.corked) {
                            await this.corked.promise;
                        }
                        const drain = this.ifca.write(data);
                        if (drain instanceof Promise) {
                            await drain;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (iterable_1_1 && !iterable_1_1.done && (_a = iterable_1.return)) await _a.call(iterable_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            this.ifca.end();
        })();
        return this;
    }
    injectArgsToCallback(callback, args) {
        if ((0, utils_1.isAsyncFunction)(callback)) {
            return async (chunk) => {
                return await callback(chunk, ...args);
            };
        }
        return (chunk) => {
            return callback(chunk, ...args);
        };
    }
    injectArgsToCallbackAndMapResult(callback, resultMapper, args) {
        if ((0, utils_1.isAsyncFunction)(callback)) {
            return async (chunk) => {
                return resultMapper(chunk, await callback(chunk, ...args));
            };
        }
        return (chunk) => {
            return resultMapper(chunk, callback(chunk, ...args));
        };
    }
}
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, Object]),
    __metadata("design:returntype", DataStream)
], DataStream.prototype, "each", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, Object]),
    __metadata("design:returntype", DataStream)
], DataStream.prototype, "map", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, Object]),
    __metadata("design:returntype", DataStream)
], DataStream.prototype, "filter", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, Object]),
    __metadata("design:returntype", DataStream)
], DataStream.prototype, "batch", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, Object]),
    __metadata("design:returntype", DataStream)
], DataStream.prototype, "flatMap", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", typeof (_a = typeof NEW_OUT !== "undefined" && NEW_OUT) === "function" ? _a : Object)
], DataStream.prototype, "use", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function, typeof (_b = typeof NEW_OUT !== "undefined" && NEW_OUT) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], DataStream.prototype, "reduce", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DataStream.prototype, "toArray", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DataStream.prototype, "run", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DataStream.prototype, "toFile", null);
exports.DataStream = DataStream;
//# sourceMappingURL=data-stream.js.map