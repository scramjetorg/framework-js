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

    console.log("split", newStream);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");

    const newStream2 = newStream.split("1");

    console.log("split", newStream2);

    t.true(newStream2 instanceof StringStream, `Should be an instance of StringStream, not ${newStream2.constructor.name}`);
    t.deepEqual(newStream2.constructor.name, "StringStream");
});

test("StringStream flatMap returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.flatMap(chunk => [chunk]);

    console.log("flatMap", newStream);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");

    const newStream2 = newStream.split("1");

    console.log("split", newStream2);

    t.true(newStream2 instanceof StringStream, `Should be an instance of StringStream, not ${newStream2.constructor.name}`);
    t.deepEqual(newStream2.constructor.name, "StringStream");
});

test("StringStream filter returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.filter(chunk => parseInt(chunk, 10) % 2 === 0);

    console.log("filter", newStream);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");

    const newStream2 = newStream.split("1");

    console.log("split", newStream2);

    t.true(newStream2 instanceof StringStream, `Should be an instance of StringStream, not ${newStream2.constructor.name}`);
    t.deepEqual(newStream2.constructor.name, "StringStream");
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
