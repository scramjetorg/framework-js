import test from "ava";
import { StringStream } from "../../../src/streams/string-stream";

test("StringStream can split chunks by given split sequence #1", async (t) => {
    const stringStream = StringStream.from(["foo1bar", "baz111bax", "123", "345", "011", "201"]) as StringStream;
    const result = await stringStream.split("1").toArray();

    t.deepEqual(result, ["foo", "barbaz", "", "", "bax", "233450", "", "20", ""]);
});

test("StringStream can split chunks by given split sequence #2", async (t) => {
    const stringStream = StringStream.from(["foo1bar", "barbaz", "1bar3", "baxbar", "bar", "barbay"]) as StringStream;
    const result = await stringStream.split("bar").toArray();

    t.deepEqual(result, ["foo1", "", "baz1", "3bax", "", "", "bay"]);
});

test("StringStream split ends correctly if there is no split sequence in input data", async (t) => {
    const stringStream = StringStream.from(["foo1bar", "baz11bax", "123", "345", "011", "201"]) as StringStream;
    const result = await stringStream.split("\n").toArray();

    t.deepEqual(result, ["foo1barbaz11bax123345011201"]);
});

test("StringStream split works correctly if there are only split sequences in input data", async (t) => {
    const stringStream = StringStream.from(["foo", "foofoo", "foo"]) as StringStream;
    const result = await stringStream.split("foo").toArray();

    t.deepEqual(result, ["", "", "", "", ""]);
});
