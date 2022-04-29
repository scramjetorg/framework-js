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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringStream = void 0;
const data_stream_1 = require("./data-stream");
const decorators_1 = require("../decorators");
class StringStream extends data_stream_1.DataStream {
    each(callback, ...args) {
        return super.each(callback, ...args);
    }
    map(callback, ...args) {
        return super.map(callback, ...args);
    }
    filter(callback, ...args) {
        return super.filter(callback, ...args);
    }
    flatMap(callback, ...args) {
        return super.flatMap(callback, ...args);
    }
    use(callback) {
        return super.use(callback);
    }
    split(splitBy) {
        const result = {
            emitLastValue: false,
            lastValue: ""
        };
        const testFn = toString.call(splitBy) === "[object RegExp]"
            ? (chunk) => splitBy.test(chunk) : (chunk) => chunk.includes(splitBy);
        this.ifcaChain.create(this.options);
        const newStream = this.createChildStream();
        const callbacks = {
            onChunkCallback: async (chunk) => {
                const tmpChunk = `${result.lastValue}${chunk}`;
                result.emitLastValue = true;
                if (testFn(tmpChunk)) {
                    const chunks = tmpChunk.split(splitBy);
                    result.lastValue = chunks.pop();
                    for (const item of chunks) {
                        await newStream.ifca.write(item);
                    }
                }
                else {
                    result.lastValue = tmpChunk;
                }
            },
            onEndCallback: async () => {
                if (result.emitLastValue) {
                    await newStream.ifca.write(result.lastValue);
                }
                newStream.ifca.end();
            }
        };
        (this.getReaderAsyncCallback(false, callbacks))();
        return newStream;
    }
    parse(callback, ...args) {
        return super.map(callback, ...args);
    }
    grep(pattern) {
        return this.filter(chunk => pattern.test(chunk));
    }
    match(pattern) {
        var _a;
        this.ifcaChain.create(this.options);
        const regexpGroupsNr = ((_a = pattern.source.match(/\((?!\?)/g)) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const newStream = this.createChildStream();
        let onChunkCallback;
        if (regexpGroupsNr === 0 || regexpGroupsNr === 1) {
            onChunkCallback = async (chunk) => {
                const matches = chunk.matchAll(pattern);
                for (const item of matches) {
                    await newStream.ifca.write(item[regexpGroupsNr]);
                }
            };
        }
        else {
            onChunkCallback = async (chunk) => {
                const matches = chunk.matchAll(pattern);
                for (const item of matches) {
                    for (let i = 1; i <= regexpGroupsNr; i++) {
                        await newStream.ifca.write(item[i]);
                    }
                }
            };
        }
        const callbacks = {
            onChunkCallback,
            onEndCallback: async () => {
                newStream.ifca.end();
            }
        };
        (this.getReaderAsyncCallback(false, callbacks))();
        return newStream;
    }
    createChildStream() {
        this.readable = false;
        this.transformable = false;
        return new StringStream(this.options, this);
    }
}
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", StringStream)
], StringStream.prototype, "split", null);
__decorate([
    decorators_1.checkTransformability,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RegExp]),
    __metadata("design:returntype", StringStream)
], StringStream.prototype, "match", null);
exports.StringStream = StringStream;
//# sourceMappingURL=string-stream.js.map