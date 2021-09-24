"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStream = void 0;
const stream_1 = require("stream");
const base_stream_1 = require("./base-stream");
const index_1 = require("../../ifca/lib/index");
const utils_1 = require("./utils");
class DataStream extends base_stream_1.BaseStreamCreators {
    constructor() {
        super();
        this.input = null;
        this.ifca = new index_1.IFCA(2, (chunk) => chunk);
    }
    static from(input) {
        const dataStream = new DataStream();
        dataStream.input = input;
        return dataStream;
    }
    map(callback) {
        this.ifca.addTransform(callback);
        return this;
    }
    filter(callback) {
        const isCallbackAsync = (0, utils_1.isAsyncFunction)(callback);
        if (isCallbackAsync) {
            console.log("TBD");
        }
        else {
            const newCallback = (chunk) => {
                return callback(chunk) ? chunk : index_1.DroppedChunk;
            };
            this.ifca.addTransform(newCallback);
        }
        return this;
    }
    toArray() {
        this.startReading();
        return new Promise((res) => {
            const chunks = [];
            const readChunk = () => {
                const chunk = this.ifca.read();
                if (chunk === null) {
                    res(chunks);
                }
                else if (chunk instanceof Promise) {
                    chunk.then(value => {
                        if (value === null) {
                            res(chunks);
                        }
                        else {
                            chunks.push(value);
                            readChunk();
                        }
                    });
                }
                else {
                    chunks.push(chunk);
                    readChunk();
                }
            };
            readChunk();
        });
    }
    startReading() {
        if (this.input !== null) {
            const input = this.input;
            this.input = null;
            if (input instanceof stream_1.Readable) {
                this.readFromReadble(input);
            }
            else if ((0, utils_1.isIterable)(input)) {
                this.readFromIterable(input);
            }
            else if ((0, utils_1.isAsyncIterable)(input)) {
                this.readFromAsyncIterable(input);
            }
            else {
                throw Error("Invalid input type");
            }
        }
    }
    readFromReadble(readable) {
        const readChunks = () => {
            let drain;
            let data;
            while (drain === undefined && (data = readable.read()) !== null) {
                drain = this.ifca.write(data);
            }
            if (drain instanceof Promise) {
                readable.pause();
                drain.then(() => {
                    readable.resume();
                });
            }
        };
        readable.on("readable", readChunks);
        readable.on("end", () => {
            this.ifca.write(null);
        });
    }
    readFromIterable(iterable) {
        const iterator = iterable[Symbol.iterator]();
        const readItems = () => {
            let drain;
            let data;
            while (drain === undefined && (data = iterator.next()).done !== true) {
                drain = this.ifca.write(data.value);
            }
            if (drain instanceof Promise) {
                drain.then(readItems);
            }
            if (data === null || data === void 0 ? void 0 : data.done) {
                this.ifca.write(null);
            }
        };
        readItems();
    }
    readFromAsyncIterable(iterable) {
        const iterator = iterable[Symbol.asyncIterator]();
        const readItem = () => {
            iterator.next().then(data => {
                if (data.done) {
                    this.ifca.write(null);
                }
                else {
                    const drain = this.ifca.write(data.value);
                    if (drain instanceof Promise) {
                        drain.then(readItem);
                    }
                    else {
                        readItem();
                    }
                }
            });
        };
        readItem();
    }
}
exports.DataStream = DataStream;
