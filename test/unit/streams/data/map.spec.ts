import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";
import { deferReturn } from "../../../_helpers/utils";

test("DataStream can map chunks via sync callback (to same type)", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(chunk => chunk * 2).toArray();

    t.deepEqual(result, [2, 4, 6, 8, 10]);
});

test("DataStream can map chunks via sync callback (to different type)", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(chunk => `foo-${chunk}`).toArray();

    t.deepEqual(result, ["foo-1", "foo-2", "foo-3", "foo-4", "foo-5"]);
});

test("DataStream can map chunks via async callback (to same type)", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(async chunk => deferReturn(5, chunk * 2)).toArray();

    t.deepEqual(result, [2, 4, 6, 8, 10]);
});

test("DataStream can map chunks via async callback (to different type)", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map(async chunk => deferReturn(5, `foo-${chunk}`)).toArray();

    t.deepEqual(result, ["foo-1", "foo-2", "foo-3", "foo-4", "foo-5"]);
});

test("DataStream can apply multiple map transforms", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber
        .map(chunk => chunk * 2)
        .map(async chunk => deferReturn(5, `${chunk}00`))
        .map(chunk => parseInt(chunk, 10))
        .toArray();

    t.deepEqual(result, [200, 400, 600, 800, 1000]);
});

test("DataStream map passes variadic args", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber
        .map((chunk, multiplier) => chunk * multiplier, 3)
        .map(async (chunk, postfix) => deferReturn(5, `${chunk}${postfix}`), "00")
        .toArray();

    t.deepEqual(result, ["300", "600", "900", "1200", "1500"]);
});

test("DataStream map passes typed variadic args", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber
        .map<number, number[]>((chunk, multiplier) => chunk * multiplier, 3)
        .map<string, string[]>(async (chunk, postfix) => deferReturn(5, `${chunk}${postfix}`), "00")
        .toArray();

    t.deepEqual(result, ["300", "600", "900", "1200", "1500"]);
});

test("DataStream can map chunks via sync callback (to same type) 2", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
    const result = await dsNumber.map<number, any>(chunk => chunk * 2, undefined).toArray();

    t.deepEqual(result, [2, 4, 6, 8, 10]);
});

// test("DataStream can map chunks via sync callback (to same type) 3", async (t) => {
//     const dsNumber = DataStream.from([1, 2, 3, 4, 5]);
//     const result = await dsNumber.map<number, any>(chunk => chunk * 2, void).toArray();

//     t.deepEqual(result, [2, 4, 6, 8, 10]);
// });
