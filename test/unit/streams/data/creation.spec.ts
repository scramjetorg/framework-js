import test from "ava";
import { createReadStream } from "fs";
import { defer } from "../../../_helpers/utils";
import { DataStream } from "../../../../src/streams/data-stream";

test("DataStream can be constructed", (t) => {
    const dsNumber = new DataStream<number>();
    const dsString = new DataStream<string>();

    t.true(dsNumber instanceof DataStream);
    t.true(dsString instanceof DataStream);
});

test("DataStream can be created via static from method", (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4]);
    const dsString = DataStream.from(["1", "2", "3", "4"]);
    const dsAny = DataStream.from([1, 2, "3", "4"]);

    t.true(dsNumber instanceof DataStream);
    t.true(dsString instanceof DataStream);
    t.true(dsAny instanceof DataStream);
});

test("DataStream can be cretaed from an empty iterable", async (t) => {
    const input: number[] = [];
    const dsNumber = DataStream.from(input);
    const result = await dsNumber.toArray();

    t.deepEqual(result, input);
});

test("DataStream can read from iterable", async (t) => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const dsNumber = DataStream.from(input);
    const result = await dsNumber.toArray();

    t.deepEqual(result, input);
});

test("DataStream can read from generator (iterable)", async (t) => {
    function* numbers() {
        for (let i = 0; i < 8; i++) {
            yield i;
        }
    }

    const dsNumber = DataStream.from(numbers());
    const result = await dsNumber.toArray();

    t.deepEqual(result, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("DataStream can read from async iterable", async (t) => {
    const words = {
        async*[Symbol.asyncIterator]() {
            yield "foo";
            yield "bar";
            yield "baz";
            yield "bax";
            yield "foo2";
            yield "bar2";
            yield "baz2";
            yield "bax2";
        }
    };
    const dsWords = DataStream.from<string, DataStream<string>>(words);
    const result = await dsWords.toArray();

    t.deepEqual(result, ["foo", "bar", "baz", "bax", "foo2", "bar2", "baz2", "bax2"]);
});

test("DataStream can read from another scramjet stream", async (t) => {
    const dsNumber = DataStream.from([1, 2, 3, 4]);
    const dsNumber2 = DataStream.from(dsNumber);
    const result = await dsNumber2.toArray();

    t.deepEqual(result, [1, 2, 3, 4]);
});

test("DataStream can read from readable", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", "utf8");
    const dsString = DataStream.from<string, DataStream<string>>(readable);
    const result = await dsString.toArray();

    t.deepEqual(result, ["foo\nbar\nbaz\nbax\n"]);
});

test("DataStream can be constructed from file", async (t) => {
    const ds = DataStream.fromFile<string, DataStream<string>>("./build/test/_assets/sample.txt", { readStream: { encoding: "utf8" } });

    t.true(ds instanceof DataStream);

    const result = await ds.toArray();

    t.deepEqual(result, ["foo\nbar\nbaz\nbax\n"]);
});

test("DataStream will not start reading until 'output' transfomration is called (generator)", async (t) => {
    let startedReading = false;

    function* numbers() {
        for (let i = 0; i < 8; i++) {
            startedReading = true;
            yield i;
        }
    }

    const dsNumber = DataStream.from(numbers());

    t.false(startedReading);

    await dsNumber.toArray();

    t.true(startedReading);
});

test("DataStream will not start reading until 'output' transfomration is called (readable)", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", "utf8");
    const dsString = DataStream.from<string, DataStream<string>>(readable);

    // Since readable will be read at once, if it's not ended means reading haven't started yet.
    t.false(readable.readableEnded);

    await dsString.toArray();

    t.true(readable.readableEnded);
});

test("DataStream can be corked and uncorked", async (t) => {
    const ref: any = {};
    const yielded: number[] = [];

    function* numbers() {
        for (let i = 0; i < 8; i++) {
            yield i;
            yielded.push(i);
            if (i % 3 === 1) {
                ref.dataStream._cork();
            }
        }
    }

    const dsNumber = DataStream.from(numbers());

    ref.dataStream = dsNumber as any;

    t.deepEqual(yielded, []);

    const resultPromise = dsNumber.toArray();

    await defer(0);

    t.deepEqual(yielded, [0, 1]);

    dsNumber._uncork();

    await defer(0);

    t.deepEqual(yielded, [0, 1, 2, 3, 4]);

    dsNumber._uncork();

    await defer(0);

    t.deepEqual(yielded, [0, 1, 2, 3, 4, 5, 6, 7]);

    const result = await resultPromise;

    t.deepEqual(result, [0, 1, 2, 3, 4, 5, 6, 7]);
});
