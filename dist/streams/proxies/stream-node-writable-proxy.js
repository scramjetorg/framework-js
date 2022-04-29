"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamAsNodeWritableProxy = void 0;
const events_1 = __importDefault(require("events"));
class StreamAsNodeWritableProxy extends events_1.default {
    constructor(instance) {
        super();
        this.instance = instance;
        this.isPiped = false;
        this.attachListeners();
    }
    get writable() {
        return this.instance;
    }
    write(chunk) {
        const drain = this.instance.write(chunk);
        if (drain instanceof Promise) {
            drain.then(() => {
                this.emit("drain");
            });
            return false;
        }
        return true;
    }
    end() {
        this.instance.end();
        return this;
    }
    attachListeners() {
        const stream = this.instance;
        this.orgOn = stream.on;
        stream.on = (eventName, listener) => {
            this.on(eventName, listener);
            return this.instance;
        };
        stream.once = (eventName, listener) => {
            this.once(eventName, listener);
            return this.instance;
        };
        stream.removeListener = (eventName, listener) => {
            this.removeListener(eventName, listener);
            return this.instance;
        };
        stream.emit = this.getEmitProxy();
    }
    detachListeners() {
        const stream = this.instance;
        stream.on = this.orgOn;
        stream.once = undefined;
        stream.removeListener = undefined;
        stream.emit = undefined;
    }
    getEmitProxy() {
        return (eventName, ...args) => {
            const hasListeners = this.emit(eventName, ...args);
            const source = args[0];
            const oldDest = this.instance;
            const newDest = this;
            if (eventName === "pipe") {
                source.unpipe(oldDest);
            }
            else if (eventName === "unpipe") {
                this.isPiped = true;
                source.pipe(newDest);
                this.detachListeners();
                const unpipe = source.unpipe;
                source.unpipe = (...args1) => {
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
exports.StreamAsNodeWritableProxy = StreamAsNodeWritableProxy;
//# sourceMappingURL=stream-node-writable-proxy.js.map