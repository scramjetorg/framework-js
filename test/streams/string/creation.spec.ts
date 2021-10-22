import test from "ava";
import { StringStream } from "../../../src/streams/string-stream";

test("StringStream can be constructed", (t) => {
    const stringStream = new StringStream<string>();

    t.true(stringStream instanceof StringStream);
});

test("StringStream can be created via static from method", (t) => {
    const stringStream = StringStream.from<string>(["1", "2", "3", "4"]);
    const stringStreamAny = StringStream.from(["1", "2", "3", "4"]);

    t.true(stringStream instanceof StringStream);
    t.true(stringStreamAny instanceof StringStream);
});
