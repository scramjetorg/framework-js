import test from "ava";
import { StringStream } from "../../../../src/streams/string-stream";

test("StringStream grep filters out chunks not matching passed pattern", async (t) => {
    const stringStream = StringStream.from(["John", "Johnatan", "Johannes", "James", "Josh", "jelly", "joh"]);
    const result = await stringStream.grep(/[J|j]ohn?/).toArray();

    t.deepEqual(result, ["John", "Johnatan", "Johannes", "joh"]);
});
