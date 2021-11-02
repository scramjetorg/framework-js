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

    console.log("split", newStream); // returns DataStream due to .asNewFlattenedStream call
    // newStream.split("3"); // static code analysis accpets that but it throws
    // during runtime since newStream is DataStream

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");
});

test("StringStream map returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.map(chunk => `foo-${chunk}`);

    console.log("map", newStream); // returns StringStream (since it returns this internally)
    // newStream.split("3"); // static code analysis does not accept that since
    // map should return DataStream (but it works at runtime)

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");
});

test("StringStream flatMap returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.flatMap(chunk => [chunk]);

    console.log("flatMap", newStream); // returns DataStream due to .asNewFlattenedStream call
    // newStream.split("3"); // static code analysis does not accept that since
    // map should return DataStream (an it throws at runtime)

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");
});

test("StringStream filter returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.filter(chunk => parseInt(chunk, 10) % 2 === 0);

    console.log("filter", newStream); // returns StringStream (since it returns this internally)
    // newStream.split("3"); // static code analysis does not accept that since
    // map should return DataStream (but it works at runtime)

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
