import test from "ava";
import { StringStream } from "../../../../src/streams/string-stream";

test("StringStream each iterates over each chunk", async (t) => {
    const chunks: string[] = [];
    const stringStream = StringStream.from(["foo1bar", "baz111bax", "123", "345", "011", "201"]);
    const result = await stringStream.each(chunk => {
        chunks.push(chunk);
    }).toArray();

    t.deepEqual(result, ["foo1bar", "baz111bax", "123", "345", "011", "201"]);
    t.deepEqual(chunks, ["foo1bar", "baz111bax", "123", "345", "011", "201"]);
});
