import test from "ava";
import { DataStream } from "../../../src/streams/data-stream";
import { deferReturn } from "../../helpers/utils";

test("DataStream batch can make sentences from words", async (t) => {
    const result = await DataStream
        .from(["foo", "bar.", "baz", "bax", ".", "foo"])
        .batch(chunk => chunk.endsWith("."))
        .toArray();

    t.deepEqual(result, [["foo", "bar."], ["baz", "bax", "."], ["foo"]]);
});

test("DataStream batch can make sentences from words (async)", async (t) => {
    const result = await DataStream
        .from(["foo", "bar.", "baz", "bax", ".", "foo"])
        .batch(async (chunk) => deferReturn(5, chunk.endsWith(".")))
        .toArray();

    t.deepEqual(result, [["foo", "bar."], ["baz", "bax", "."], ["foo"]]);
});

test("DataStream batch can bu used to batch by amount (via variadic arg counter)", async (t) => {
    const result = await DataStream
        .from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        .batch((chunk, counter) => { counter.i++; return counter.i % 3 === 0; }, { i: 0 })
        .toArray();

    t.deepEqual(result, [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]]);
});
