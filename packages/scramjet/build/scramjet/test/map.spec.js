"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const data_stream_1 = require("../lib/data-stream");
(0, ava_1.default)("DataStream can map chunks via sync callback (to same type)", async (t) => {
    const dsNumber = data_stream_1.DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(chunk => chunk * 2).toArray();
    t.deepEqual(result, [2, 4, 6, 8, 10]);
});
(0, ava_1.default)("DataStream can map chunks via sync callback (to different type)", async (t) => {
    const dsNumber = data_stream_1.DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(chunk => `foo-${chunk}`).toArray();
    t.deepEqual(result, ['foo-1', 'foo-2', 'foo-3', 'foo-4', 'foo-5']);
});
(0, ava_1.default)("DataStream can map chunks via async callback (to same type)", async (t) => {
    const dsNumber = data_stream_1.DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(chunk => {
        return new Promise(res => {
            setTimeout(() => {
                res(chunk * 2);
            }, 10);
        });
    }).toArray();
    t.deepEqual(result, [2, 4, 6, 8, 10]);
});
(0, ava_1.default)("DataStream can map chunks via async callback (to different type)", async (t) => {
    const dsNumber = data_stream_1.DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(chunk => {
        return new Promise(res => {
            setTimeout(() => {
                res(`foo-${chunk}`);
            }, 10);
        });
    }).toArray();
    t.deepEqual(result, ['foo-1', 'foo-2', 'foo-3', 'foo-4', 'foo-5']);
});
(0, ava_1.default)("DataStream can apply multiple map transforms", async (t) => {
    const dsNumber = data_stream_1.DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber
        .map(chunk => chunk * 2)
        .map(chunk => {
        return new Promise(res => {
            setTimeout(() => {
                res(`${chunk}00`);
            }, 10);
        });
    })
        .map(chunk => parseInt(chunk))
        .toArray();
    t.deepEqual(result, [200, 400, 600, 800, 1000]);
});
