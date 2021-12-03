import test from "ava";
import { readFileSync, unlinkSync } from "fs";
import { DataStream } from "../../../../src/streams/data-stream";

test("Can write stream data to file", async (t) => {
    const stream = DataStream.from(["foo", "bar", "baz", "bax"]);

    const filePath = `./build/test/tmp-tofile1-${ Date.now() }.txt`;

    await stream.toFile(filePath);

    const data = readFileSync(filePath, "utf8");

    t.deepEqual(data, "foobarbazbax");

    unlinkSync(filePath);
});

test("Can write stream data to file (with map)", async (t) => {
    const stream = DataStream
        .from(["foo", "bar", "baz", "bax"])
        .map(chunk => `${ chunk }\n`);

    const filePath = `./build/test/tmp-tofile2-${ Date.now() }.txt`;

    await stream.toFile(filePath);

    const data = readFileSync(filePath, "utf8");

    t.deepEqual(data, "foo\nbar\nbaz\nbax\n");

    unlinkSync(filePath);
});
