import test from "ava";
import { createReadStream } from "fs";
import { Writable } from "stream";
import { DataStream } from "../../../../src/streams/data-stream";
import { deferReturn, defer } from "../../../_helpers/utils";

test("DataStream can be iterated with 'for await..of'", async (t) => {
    const result = [];
    const stream = DataStream
        .from(["1", "2", "3", "4", "5", "6"])
        .map<number, number[]>(parseInt, 10)
        .filter(chunk => !!(chunk % 2));


    for await (const chunk of stream) {
        result.push(chunk);
    }

    t.deepEqual(result, [1, 3, 5]);
});

test("DataStream can piped from nodejs Readable stream", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", "utf8");
    const stream = new DataStream<string>();

    readable.pipe(stream.asWritable());

    const result = await stream.toArray();

    t.deepEqual(result, ["foo\nbar\nbaz\nbax\n"]);
});

test("DataStream can piped from nodejs Readable stream (intermediate stream)", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", "utf8");
    const stream = new DataStream<string>();
    const stream2 = stream.map(chunk => chunk.toUpperCase());

    readable.pipe(stream.asWritable());

    const result = await stream2.toArray();

    t.deepEqual(result, ["FOO\nBAR\nBAZ\nBAX\n"]);
});


test("DataStream cannot be piped directly from nodejs Readable stream", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", "utf8");
    const stream = new DataStream<string>();

    t.throws(() => readable.pipe(stream as any as Writable));
});

test("DataStream can piped from nodejs Readable stream (read one byte at a time)", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", { encoding: "utf8", highWaterMark: 1 });
    const stream = new DataStream<string>();

    readable.pipe(stream.asWritable());

    const result = await stream.toArray();

    t.deepEqual(result, ["f", "o", "o", "\n", "b", "a", "r", "\n", "b", "a", "z", "\n", "b", "a", "x", "\n"]);
});

test("DataStream can piped from nodejs Readable stream and keep correct backpressure", async (t) => {
    const assertBackpressure = (stream: any): void => {
        const state = stream.ifca.state;

        t.true(state.all <= state.maxParallel, `Number of chunks processed ${ state.all } should respect maxParallel of ${ state.maxParallel }`);
    };
    const readable = createReadStream("./build/test/_assets/sample.txt", { encoding: "utf8", highWaterMark: 2 });
    const stream = new DataStream<string>({ maxParallel: 2 })
        .map(chunk => { assertBackpressure(stream); return deferReturn(25, chunk); });

    readable.pipe(stream.asWritable());

    const result = await stream.toArray();

    t.deepEqual(result, ["fo", "o\n", "ba", "r\n", "ba", "z\n", "ba", "x\n"]);
});

test("Piped DataStream can be unpiped via '.unpipe(instance)'", (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", { encoding: "utf8", highWaterMark: 2 });
    const stream = new DataStream<string>({ maxParallel: 2 })
        .map(chunk => deferReturn(20, chunk));

    return new Promise(resolve => {
        readable.once("readable", async () => {
            const writable = readable.pipe(stream.asWritable());

            // This call in comibnation with defer below will make 2 first ready chunks to be read and 2 next
            // pending before unpipeing occurs.
            const result = stream.toArray();

            // We need quite significant delay to keep this test stable.
            await defer(30);

            readable.unpipe(writable);

            // Calling end will simply flush all pending chunks from IFCA queue (so we will have 4 chunks in total).
            await stream.end();

            t.deepEqual(await result, ["fo", "o\n", "ba", "r\n"]);

            resolve();
        });
    });
});

test("Piped DataStream can be unpiped via '.unpipe(instance)' #2", (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", { encoding: "utf8", highWaterMark: 2 });
    const stream = new DataStream<string>({ maxParallel: 2 })
        .map(chunk => deferReturn(10, chunk));

    return new Promise(resolve => {
        readable.once("readable", async () => {
            const writable = readable.pipe(stream.asWritable());

            await defer(5);

            readable.unpipe(writable);

            // Calling end will simply flush all pending chunks from IFCA queue (so we will have 2 chunks in total).
            await stream.end();

            t.deepEqual(await stream.toArray(), ["fo", "o\n"]);

            resolve();
        });
    });
});

test("Piped DataStream can be unpiped via '.unpipe()'", (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", { encoding: "utf8", highWaterMark: 2 });
    const stream = new DataStream<string>({ maxParallel: 2 })
        .map(chunk => deferReturn(20, chunk));

    return new Promise(resolve => {
        readable.once("readable", async () => {
            readable.pipe(stream.asWritable());

            // This call in comibnation with defer below will make 2 first ready chunks to be read and 2 next
            // pending before unpipeing occurs.
            const result = stream.toArray();

            // We need quite significant delay to keep this test stable.
            await defer(30);

            readable.unpipe();

            // Calling end will simply flush all pending chunks from IFCA queue (so we will have 4 chunks in total).
            await stream.end();

            t.deepEqual(await result, ["fo", "o\n", "ba", "r\n"]);

            resolve();
        });
    });
});

test("Piped DataStream can be unpiped via '.unpipe()' #2", (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", { encoding: "utf8", highWaterMark: 2 });
    const stream = new DataStream<string>({ maxParallel: 2 })
        .map(chunk => deferReturn(10, chunk));

    return new Promise(resolve => {
        readable.once("readable", async () => {
            readable.pipe(stream.asWritable());

            await defer(5);

            readable.unpipe();

            // Calling end will simply flush all pending chunks from IFCA queue (so we will have 2 chunks in total).
            await stream.end();

            t.deepEqual(await stream.toArray(), ["fo", "o\n"]);

            resolve();
        });
    });
});

test("Native pipe with DataStream returns the same instance which was passed as an argument", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", "utf8");
    const stream = new DataStream<string>();

    const stream2 = readable.pipe(stream.asWritable());

    t.is(stream, stream2 as any as DataStream<string>);
});

test("Calling 'DataStream.on()' should throw", async (t) => {
    const stream = new DataStream<string>();

    t.throws(() => (stream as any).on("fake"));
});

test("After pipe is called DataStream has no event-emitter like methods", async (t) => {
    const readable = createReadStream("./build/test/_assets/sample.txt", "utf8");
    const stream = new DataStream<string>();

    readable.pipe(stream.asWritable());

    t.true((stream as any).once === undefined);
    t.true((stream as any).removeListener === undefined);
    t.true((stream as any).emit === undefined);
});

test("DataStream writable proxy emit returns whether there are listeners attached (true)", async (t) => {
    const stream = new DataStream<string>();
    const streamAsWritable = stream.asWritable();

    streamAsWritable.on("fake", () => {});

    t.true(streamAsWritable.emit("fake"));
});

test("DataStream writable proxy emit returns whether there are listeners attached (false)", async (t) => {
    const stream = new DataStream<string>();
    const streamAsWritable = stream.asWritable();

    t.false(streamAsWritable.emit("fake"));
});

test("DataStream writable proxy emit cna handle unexpected unpipe data", async (t) => {
    const stream = new DataStream<string>();
    const streamAsWritable = stream.asWritable();

    const streamMock = {
        pipe: () => {},
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        unpipe: (...args: any[]) => {},
    };

    t.notThrows(() => {
        streamAsWritable.emit("unpipe", streamMock);
        streamMock.unpipe(["fake", "data"]);
    });
});
