"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const fs_1 = require("fs");
const data_stream_1 = require("../lib/data-stream");
(0, ava_1.default)("DataStream can be constructed", (t) => {
    const dsNumber = new data_stream_1.DataStream();
    const dsString = new data_stream_1.DataStream();
    t.true(dsNumber instanceof data_stream_1.DataStream);
    t.true(dsString instanceof data_stream_1.DataStream);
});
(0, ava_1.default)("DataStream can be created via static from method", (t) => {
    const dsNumber = data_stream_1.DataStream.from([1, 2, 3, 4]);
    const dsString = data_stream_1.DataStream.from(['1', '2', '3', '4']);
    const dsAny = data_stream_1.DataStream.from([1, 2, '3', '4']);
    t.true(dsNumber instanceof data_stream_1.DataStream);
    t.true(dsString instanceof data_stream_1.DataStream);
    t.true(dsAny instanceof data_stream_1.DataStream);
});
(0, ava_1.default)("DataStream can be cretaed from an empty iterable", async (t) => {
    const input = [];
    const dsNumber = data_stream_1.DataStream.from(input);
    const result = await dsNumber.toArray();
    t.deepEqual(result, input);
});
(0, ava_1.default)("DataStream can read from iterable", async (t) => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const dsNumber = data_stream_1.DataStream.from(input);
    const result = await dsNumber.toArray();
    t.deepEqual(result, input);
});
(0, ava_1.default)("DataStream can read from generator (iterable)", async (t) => {
    function* numbers() {
        for (let i = 0; i < 8; i++) {
            yield i;
        }
    }
    const dsNumber = data_stream_1.DataStream.from(numbers());
    const result = await dsNumber.toArray();
    t.deepEqual(result, [0, 1, 2, 3, 4, 5, 6, 7]);
});
(0, ava_1.default)("DataStream can read from async iterable", async (t) => {
    const words = {
        [Symbol.asyncIterator]() {
            return __asyncGenerator(this, arguments, function* _a() {
                yield yield __await("foo");
                yield yield __await("bar");
                yield yield __await("baz");
                yield yield __await("bax");
            });
        }
    };
    const dsWords = data_stream_1.DataStream.from(words);
    const result = await dsWords.toArray();
    t.deepEqual(result, ['foo', 'bar', 'baz', 'bax']);
});
(0, ava_1.default)("DataStream can read from readable", async (t) => {
    const readable = (0, fs_1.createReadStream)('./test/helpers/sample.txt', 'utf8');
    const dsString = data_stream_1.DataStream.from(readable);
    const result = await dsString.toArray();
    t.deepEqual(result, ['foo\nbar\nbaz\nbax\n']);
});
(0, ava_1.default)("DataStream will not start reading until 'output' transfomration is called (generator)", async (t) => {
    let startedReading = false;
    function* numbers() {
        for (let i = 0; i < 8; i++) {
            startedReading = true;
            yield i;
        }
    }
    const dsNumber = data_stream_1.DataStream.from(numbers());
    t.false(startedReading);
    await dsNumber.toArray();
    t.true(startedReading);
});
(0, ava_1.default)("DataStream will not start reading until 'output' transfomration is called (readable)", async (t) => {
    const readable = (0, fs_1.createReadStream)('./test/helpers/sample.txt', 'utf8');
    const dsString = data_stream_1.DataStream.from(readable);
    t.false(readable.readableEnded);
    await dsString.toArray();
    t.true(readable.readableEnded);
});
