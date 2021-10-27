import test from "ava";
import { StringStream } from "../../../src/streams/string-stream";

test("StringStream can be constructed", (t) => {
    const stringStream = new StringStream();

    t.true(stringStream instanceof StringStream);
});

test("StringStream can be created via static from method", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);

    t.true(stringStream instanceof StringStream);
});

test("StringStream split returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.split("2");

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");
});

test("StringStream map returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.map(chunk => `foo-${chunk}`);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");
});

test("StringStream flatMap returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.flatMap(chunk => [chunk]);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");
});

test("StringStream filter returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.filter(chunk => parseInt(chunk, 10) % 2 === 0);

    // This is kind of tricky since static code analysis shows that "stringStream.filter" returns
    // DataString<string> (as declared in method return type)
    // but on runtime, it internally returns "this" which is StringStream
    //
    // So it can be solved like:
    //
    // StringStream.filter<W extends any[] = []>(
    //     callback: TransformFunction<string, Boolean, W>,
    //     ...args: W): StringStream
    // {
    //     return super.filter(callback, ...args) as StringStream;
    // }

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");
});
