import test from "ava";
import { StringStream } from "../../../../src/streams/string-stream";
import { DataStream } from "../../../../src/streams/data-stream";

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

    // This checks if "newStream" is a correct type in compile time.
    const newStream2 = newStream.split("1");

    t.true(newStream2 instanceof StringStream, `Should be an instance of StringStream, not ${newStream2.constructor.name}`);
    t.deepEqual(newStream2.constructor.name, "StringStream");
});

test("StringStream flatMap returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.flatMap(chunk => [chunk]);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");

    // This checks if "newStream" is a correct type in compile time.
    const newStream2 = newStream.split("1");

    t.true(newStream2 instanceof StringStream, `Should be an instance of StringStream, not ${newStream2.constructor.name}`);
    t.deepEqual(newStream2.constructor.name, "StringStream");
});

test("StringStream filter returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.filter(chunk => parseInt(chunk, 10) % 2 === 0);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");

    // This checks if "newStream" is a correct type in compile time.
    const newStream2 = newStream.split("1");

    t.true(newStream2 instanceof StringStream, `Should be an instance of StringStream, not ${newStream2.constructor.name}`);
    t.deepEqual(newStream2.constructor.name, "StringStream");
});

test("StringStream map returns instance of StringStream", (t) => {
    const stringStream = StringStream.from(["1", "2", "3", "4"]);
    const newStream = stringStream.map(chunk => `foo-${chunk}`);

    t.true(newStream instanceof StringStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "StringStream");

    // This checks if "newStream" is a correct type in compile time.
    const newStream2 = newStream.split("1");

    t.true(newStream2 instanceof StringStream, `Should be an instance of StringStream, not ${newStream2.constructor.name}`);
    t.deepEqual(newStream2.constructor.name, "StringStream");
});

// Since batch returns "string[]" so it cannot be StringStream.
test("StringStream batch returns instance of DataStream", (t) => {
    const stringStream = StringStream.from(["11", "22", "31", "41"]);
    const newStream = stringStream.batch(chunk => chunk.endsWith("1"));

    t.true(newStream instanceof DataStream, `Should be an instance of StringStream, not ${newStream.constructor.name}`);
    t.deepEqual(newStream.constructor.name, "DataStream");
});

test("Transforming intermediate streams throws an error (first stream)", async (t) => {
    const stream = new StringStream()
        .map(chunk => `foo${ chunk }`);

    stream.map(chunk => `foo${ chunk }`);

    t.throws(() => stream.split("foo"), { message: "Stream is not transformable." });
});

test("Transforming intermediate streams throws an error (middle stream)", async (t) => {
    const stream = new StringStream()
        .map(chunk => `foo${ chunk }`);
    const stream2 = stream.split("f");

    stream2.split("o");

    t.throws(() => stream2.map(chunk => chunk.repeat(2)), { message: "Stream is not transformable." });
});
