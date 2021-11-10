import test from "ava";
import { StringStream } from "../../../../src/streams/string-stream";

test("StringStream can split chunks by given split sequence #1", async (t) => {
    const stringStream = StringStream.from(["foo1bar", "baz111bax", "123", "345", "011", "201"]);
    const result = await stringStream.split("1").toArray();

    t.deepEqual(result, ["foo", "barbaz", "", "", "bax", "233450", "", "20", ""]);
});

test("StringStream can split chunks by given split sequence #2", async (t) => {
    const stringStream = StringStream.from(["foo1bar", "barbaz", "1bar3", "baxbar", "bar", "barbay"]);
    const result = await stringStream.split("bar").toArray();

    t.deepEqual(result, ["foo1", "", "baz1", "3bax", "", "", "bay"]);
});

test("StringStream split ends correctly if there is no split sequence in input data", async (t) => {
    const stringStream = StringStream.from(["foo1bar", "baz11bax", "123", "345", "011", "201"]);
    const result = await stringStream.split("\n").toArray();

    t.deepEqual(result, ["foo1barbaz11bax123345011201"]);
});

test("StringStream split works correctly if there are only split sequences in input data", async (t) => {
    const stringStream = StringStream.from(["foo", "foofoo", "foo"]);
    const result = await stringStream.split("foo").toArray();

    t.deepEqual(result, ["", "", "", "", ""]);
});

test("StringStream split works correctly if single split sequence is split across multiple chunks", async (t) => {
    const stringStream = StringStream.from(["f", "o", "o", "barf", "oobaz123", "f", "ozfo", "ooobax", "12f", "oo"]);
    const result = await stringStream.split("foo").toArray();

    t.deepEqual(result, ["", "bar", "baz123foz", "oobax12", ""]);
});

test("StringStream split works correctly with single chunk split two multiple ones", async (t) => {
    const stringStream = StringStream.from(["this-is-single-chunk"]);
    const result = await stringStream.split("-").toArray();

    t.deepEqual(result, ["this", "is", "single", "chunk"]);
});

test("StringStream split can handle empty stream (explicit array typing)", async (t) => {
    const input: string[] = []; // explicit typing is needed here sinc TS can't deduce it on empty array
    const stringStream = StringStream.from(input);
    const result = await stringStream.split("-").toArray();

    t.deepEqual(result, []);
});

test("StringStream split can handle empty stream (explicit stream typing)", async (t) => {
    const stringStream = StringStream.from<string, StringStream>([]); // without generic types it will result in compile error since TS can't deduce empty array type
    const result = await stringStream.split("-").toArray();

    t.deepEqual(result, []);
});

test("StringStream split can stream with only one split value", async (t) => {
    const stringStream = StringStream.from(["-"]);
    const result = await stringStream.split("-").toArray();

    t.deepEqual(result, ["", ""]);
});
