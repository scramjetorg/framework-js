import test from "ava";
import { createReadStream } from "fs";
import { DataStream } from "../lib/index";

test("DataStream can be constructed", (t) => {
    const dsNumber = new DataStream<number>();
    const dsString = new DataStream<string>();

    t.true(dsNumber instanceof DataStream);
    t.true(dsString instanceof DataStream);
});

test("DataStream can be created via static from method", (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4]);
    const dsString = DataStream.from<string>(['1','2','3','4']);
    const dsAny = DataStream.from([1,2,'3','4']); // Not sure how and if we want to force using generics.

    t.true(dsNumber instanceof DataStream);
    t.true(dsString instanceof DataStream);
    t.true(dsAny instanceof DataStream);
});

test("DataStream can be cretaed from an empty iterable", async (t) => {
    const input: number[] = [];
    const dsNumber = DataStream.from<number>(input);

    const result = await dsNumber.toArray();
    t.deepEqual(result, input);
});

test("DataStream can read from iterable", async (t) => {
    const input = [1,2,3,4,5,6,7,8];
    const dsNumber = DataStream.from<number>(input);

    const result = await dsNumber.toArray();
    t.deepEqual(result, input);
});

test("DataStream can read from generator (iterable)", async (t) => {
    function * numbers() {
        for(let i = 0; i < 8; i++) {
            yield i;
        }
    }

    const dsNumber = DataStream.from<number>(numbers());

    const result = await dsNumber.toArray();
    t.deepEqual(result, [0,1,2,3,4,5,6,7]);
});

test("DataStream can read from async iterable", async (t) => {
    const words = {
        async* [Symbol.asyncIterator]() {
            yield "foo";
            yield "bar";
            yield "baz";
            yield "bax";
        }
    };

    const dsWords = DataStream.from<string>(words);
    const result = await dsWords.toArray();
    t.deepEqual(result, ['foo','bar','baz','bax']);
});

// test("DataStream can read from async generator (async iterable)", async (t) => {}); // TBD

// test("DataStream can read from another scramjet stream", async (t) => {}); // TBD

test("DataStream can read from readable", async (t) => {
    const readable = createReadStream('./test/helpers/sample.txt', 'utf8');

    const dsString = DataStream.from<string>(readable);

    const result = await dsString.toArray();
    t.deepEqual(result, ['foo\nbar\nbaz\nbax\n']);
});

test("DataStream will not start reading until 'output' transfomration is called (generator)", async (t) => {
    let startedReading = false;

    function * numbers() {
        for(let i = 0; i < 8; i++) {
            startedReading = true;
            yield i;
        }
    }

    const dsNumber = DataStream.from<number>(numbers());

    t.false(startedReading);

    await dsNumber.toArray();

    t.true(startedReading);
});

test("DataStream will not start reading until 'output' transfomration is called (readable)", async (t) => {
    const readable = createReadStream('./test/helpers/sample.txt', 'utf8');

    const dsString = DataStream.from<string>(readable);

    // Since readable will be read at once, if it's not ended means reading haven't started yet.
    t.false(readable.readableEnded);

    await dsString.toArray();

    t.true(readable.readableEnded)
});
