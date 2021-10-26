import test from "ava";
import { DataStream } from "../../../src/streams/data-stream";
import { defer } from "../../helpers/utils";

test("DataStream can flat-map chunks via sync callback (to same type)", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4]);
    const result = await dsNumber.flatMap<number>(chunk => [chunk * 2]).toArray();

    t.deepEqual(result, [2, 4, 6, 8]);
});

test("DataStream can flat-map chunks via async callback (to same type)", async (t) => {
    const dsString = DataStream.from(["it's Sunny in", "", "California"]);
    const result = await dsString.flatMap<string>(chunk => chunk.split(" ")).toArray();

    t.deepEqual(result, ["it's", "Sunny", "in", "", "California"]);
});

test("DataStream can flat-map chunks returned as sync iterator (to different type)", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4]);
    const result = await dsNumber.flatMap(chunk => {
        return (function * () {
            yield `${chunk * 2}`;
            yield `${chunk * 10}`;
        })();
    }).toArray();

    t.deepEqual(result, ["2", "10", "4", "20", "6", "30", "8", "40"]);
});

test("DataStream can flat-map chunks returned as async iterator (to different type)", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4]);
    const result = await dsNumber.flatMap(chunk => {
        return (async function * () {
            await defer(chunk * 2);
            yield `${chunk * 2}`;
            await defer(chunk * 10);
            yield `${chunk * 10}`;
        })();
    }).toArray();

    t.deepEqual(result, ["2", "10", "4", "20", "6", "30", "8", "40"]);
});

test("DataStream flatMap flattens only one level", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4]);
    const result = await dsNumber.flatMap<number[]>(chunk => [[chunk * 2]]).toArray();

    t.deepEqual(result, [[2], [4], [6], [8]]);
});

test("DataStream flatMap filters and duplicates chunks correctly", async (t) => {
    const dsNumber = DataStream.from([5, 4, -3, 20, 17, -33, -4, 18]);
    const result = await dsNumber.flatMap<number>(chunk => {
        if (chunk < 0) {
            return [];
        }
        return chunk % 2 === 0 ? [chunk] : [chunk - 1, 1];
    }).toArray();

    t.deepEqual(result, [4, 1, 4, 20, 16, 1, 18]);
});

test("DataStream flatMap passes typed variadic args", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4]);
    const result = await dsNumber
        .flatMap<number, number[]>((chunk, multiplier) => [chunk * multiplier], 3)
        .flatMap<string, string[]>(async (chunk, postfix, text) => {
            return new Promise(res => {
                setTimeout(() => {
                    res([`${chunk}${postfix}`, text]);
                }, 10);
            });
        }, "00", "foo")
        .toArray();

    t.deepEqual(result, ["300", "foo", "600", "foo", "900", "foo", "1200", "foo"]);
});
