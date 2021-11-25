import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";
import { StringStream } from "../../../../src/streams/string-stream";
import { deferReturn } from "../../../_helpers/utils";

// Run tests for different sets of "maxParallel" values for each stream.
const maxParallels = [
    // Constant
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [4, 4, 4, 4, 4],
    [8, 8, 8, 8, 8],
    // Mixed
    [2, 1, 5, 2, 9],
    [32, 1, 1, 10, 5],
    // Increasing
    [2, 4, 6, 8, 10],
    [1, 4, 16, 32, 64],
    // Decreasing
    [10, 8, 6, 4, 2],
    [64, 32, 16, 4, 1]
];

for (const maxParallel of maxParallels) {
    test(`DataStream can be piped to another DataStream, ${ maxParallel.slice(0, 2) }`, async (t) => {
        const sourceStream = DataStream.from([1, 2, 3, 4, 5, 6, 7], { maxParallel: maxParallel[0] });
        const destStream = new DataStream<number, number>({ maxParallel: maxParallel[1] });

        sourceStream.pipe(destStream);

        t.deepEqual(await destStream.toArray(), [1, 2, 3, 4, 5, 6, 7]);
    });

    test(`DataStream with transforms can be piped to another DataStream, ${ maxParallel.slice(0, 2) }`, async (t) => {
        const sourceStream = DataStream.from([1, 2, 3, 4, 5], { maxParallel: maxParallel[0] });
        const destStream = new DataStream<number, number>({ maxParallel: maxParallel[1] });

        sourceStream.map((x) => x * 2).pipe(destStream);

        t.deepEqual(await destStream.toArray(), [2, 4, 6, 8, 10]);
    });

    test(`DataStream can be piped to another DataStream with transforms, ${ maxParallel.slice(0, 2) }`, async (t) => {
        const sourceStream = DataStream.from([1, 2, 3, 4, 5], { maxParallel: maxParallel[0] });
        const destStream = sourceStream.pipe(
            new DataStream<number, number>({ maxParallel: maxParallel[1] }).map((x) => x * 2));

        t.deepEqual(await destStream.toArray(), [2, 4, 6, 8, 10]);
    });

    test(`DataStream with IFCA breaking transforms can be piped to another DataStream, ${ maxParallel.slice(0, 2) }`, async (t) => {
        const sourceStream = DataStream
            .from([1, 2, 3, 4, 5], { maxParallel: maxParallel[0] })
            .flatMap(x => [x, x + 10, x + 100]);
        const destStream = sourceStream.pipe(
            new DataStream<number, number>({ maxParallel: maxParallel[1] }));

        t.deepEqual(await destStream.toArray(), [1, 11, 101, 2, 12, 102, 3, 13, 103, 4, 14, 104, 5, 15, 105]);
    });

    test(`DataStream using write can be piped to another DataStream (toArray), ${ maxParallel.slice(0, 2) }`, async (t) => {
        const sourceStream = new DataStream<number, number>({ maxParallel: maxParallel[0] })
            .filter(x => x % 2 === 0)
            .map(x => x * 2);
        const destStream = new DataStream<number, string>({ maxParallel: maxParallel[1] }).map((x) => `${ x }`);

        sourceStream.pipe(destStream);

        // We need to use sinking method here withput awaiting so it can consume sourceStream
        // chunks as they come, otherwise the sourceStream will fill up maxParallel and block.
        const result = destStream.toArray();

        for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) {
            await sourceStream.write(i);
        }

        sourceStream.end();

        t.deepEqual(await result, ["4", "8", "12", "16"]);
    });

    test(`DataStream can be piped to multiple streams ${ maxParallel }`, async (t) => {
        const stream1 = DataStream
            .from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { maxParallel: maxParallel[0] })
            .map(x => x * 2);
        const stream2 = new DataStream<number, number>({ maxParallel: maxParallel[1] })
            .filter(x => x % 4 === 0)
            .map(x => `foo-${ x }-`);
        const stream3 = new DataStream<number>({ maxParallel: maxParallel[2] })
            .map(x => ({ value: x }));
        const stream4 = new DataStream<string>({ maxParallel: maxParallel[3] });
        const stringStream = new StringStream({ maxParallel: maxParallel[4] });

        stream1.pipe(stream2);
        stream1.pipe(stream3);

        stream2.pipe(stream4);
        stream2.pipe(stringStream);

        const [result3, result4, resultString] = await Promise.all([
            stream3.toArray(), // Result of: stream1 | stream3
            stream4.toArray(), // Result of: stream1 | stream2 | stream4
            stringStream.split("-").toArray() // Result of: stream1 | stream2 | stringStream
        ]);

        t.deepEqual(result3, [{ value: 2 }, { value: 4 }, { value: 6 }, { value: 8 },
            { value: 10 }, { value: 12 }, { value: 14 }, { value: 16 }, { value: 18 }, { value: 20 }]);
        t.deepEqual(result4, ["foo-4-", "foo-8-", "foo-12-", "foo-16-", "foo-20-"]);
        t.deepEqual(resultString, ["foo", "4", "foo", "8", "foo", "12", "foo", "16", "foo", "20", ""]);
    });

    test(`DataStream using write can be piped to another DataStream (read) #1, ${ maxParallel.slice(0, 2) }`, async (t) => {
        const sourceStream = new DataStream<number, number>({ maxParallel: maxParallel[0] })
            .map(x => x * 2);
        const destStream = new DataStream<number, string>({ maxParallel: maxParallel[1] }).map((x) => `${ x }`);

        sourceStream.pipe(destStream);

        const result = [];

        for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const [, out] = await Promise.all([sourceStream.write(i), destStream.read()]);

            result.push(out);
        }

        t.deepEqual(result, ["2", "4", "6", "8", "10", "12", "14", "16"]);
    });

    test(`DataStream using write can be piped to another DataStream (read) #2, ${ maxParallel.slice(0, 2) }`, async (t) => {
        const sourceStream = new DataStream<number, number>({ maxParallel: maxParallel[0] })
            .filter(x => x % 2 === 0)
            .map(x => x * 2);
        const destStream = new DataStream<number, string>({ maxParallel: maxParallel[1] }).map((x) => `${ x }`);

        sourceStream.pipe(destStream);

        const result = [];

        for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) {
            await sourceStream.write(i);

            // Since we filter out odd chunks, we need to read just half of initial chunks number.
            if (i % 2 === 0) {
                result.push(await destStream.read());
            }
        }

        t.deepEqual(result, ["4", "8", "12", "16"]);
    });
}

test("DataStream pipe ends destination stream", async (t) => {
    const sourceStream = DataStream.from([1, 2, 3, 4, 5, 6, 7]);
    const destStream = new DataStream<number, number>();

    sourceStream.pipe(destStream);

    for (let i = 0; i < 7; i++) {
        await destStream.read();
    }

    t.throws(() => destStream.write(8), { message: "Write after end" }, "Throws if stream is ended.");
});

test("DataStream pipe does not end destination stream if end:false passed", async (t) => {
    const sourceStream = DataStream.from([1, 2, 3, 4, 5, 6, 7]);
    const destStream = new DataStream<number, number>();

    sourceStream.pipe(destStream, { end: false });

    for (let i = 0; i < 7; i++) {
        await destStream.read();
    }

    t.notThrows(() => destStream.write(8), "Should not throw if stream is not ended.");
});

test("Pipe source can be read from", async (t) => {
    const sourceStream = DataStream.from([1, 2, 3, 4, 5, 6, 7]);
    const destStream = new DataStream<number, number>();

    sourceStream.pipe(destStream);

    const read = await sourceStream.read();

    // First chunk, which is one will be send to a piped stream,
    // so the result of the read will be second chunk.
    t.deepEqual(read, 2);
});

test("Pipe source can be piped from again", async (t) => {
    const sourceStream = DataStream.from([1, 2, 3, 4, 5, 6, 7]);
    const destStream1 = new DataStream<number, number>();
    const destStream2 = new DataStream<number, number>();

    sourceStream.pipe(destStream1);

    t.notThrows(() => sourceStream.pipe(destStream2), "Should not throw.");
});

test("Pipe source cannot be transformed further", async (t) => {
    const sourceStream = DataStream.from([1, 2, 3, 4, 5, 6, 7]);
    const destStream = new DataStream<number, number>();

    sourceStream.pipe(destStream);

    t.throws(() => sourceStream.map(x => x * 2), { message: "Stream is not transformable." }, "Should throw.");
});

test("Pipe keeps correct backpressure (1 destination)", async (t) => {
    const assert = (stream: any) => {
        t.true(stream.ifca.state.all <= stream.ifca.state.maxParallel,
            `Backpressure is not exceeded (${ stream.ifca.state }).`);
    };
    const stream1 = DataStream.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { maxParallel: 5 });
    const stream2 = new DataStream<number>({ maxParallel: 3 })
        .map(x => { assert(stream2); deferReturn(10, x); });

    stream1.pipe(stream2);

    await stream2.toArray();
});

test("Pipe keeps correct backpressure (2 destinations)", async (t) => {
    const state = {
        stream1: [0],
        stream2: [0],
        stream3: [0]
    };
    const assert = (name: string, stream: any) => {
        t.true(stream.ifca.state.all <= stream.ifca.state.maxParallel,
            `Backpressure is not exceeded (${ name }, ${ stream.ifca.state }).`);

        if (name === "stream3") {
            t.true(state.stream3.length === state.stream2.length, "Stream3 has same number of chunks done or in progress.");
        }
    };
    const stream1 = DataStream
        .from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], { maxParallel: 7 })
        .map(x => { state.stream1.push(x); assert("stream1", stream1); return x; });
    const stream2 = new DataStream<number>({ maxParallel: 3 })
        .map(x => { state.stream2.push(x); assert("stream2", stream2); return deferReturn(10, x); });
    const stream3 = new DataStream<number>({ maxParallel: 5 })
        .map(x => { state.stream3.push(x); assert("stream3", stream3); return deferReturn(5, x); });

    stream1.pipe(stream2);
    stream1.pipe(stream3);

    await Promise.all([stream2.toArray(), stream3.toArray()]);
});
