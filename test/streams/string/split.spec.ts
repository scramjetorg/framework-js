import test from "ava";
import { StringStream } from "../../../src/streams/string-stream";

test("StringStream can split chunks by given split sequence", async (t) => {
    const stringStream = StringStream.from(["foo1bar", "baz111bax", "123", "345", "011", "201"]);
    const result = await stringStream.split("1").toArray();

    t.deepEqual(result, ["foo", "barbaz", "", "", "bax", "233450", "", "20", ""]);
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
