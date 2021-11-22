import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";

for (const maxParallel of [1, 2, 4, 8]) {
    test(`Can write to stream created via constructor (maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });

        stream.write(10);
        stream.write(20);
        stream.write(30);

        stream.end();

        t.deepEqual(await stream.toArray(), [10, 20, 30]);
    });

    test(`Can write to stream created with from (maxParallel: ${ maxParallel })`, async (t) => {
        const stream = DataStream.from([10, 20, 30], { maxParallel });

        // Since ".from()" is async, written values will be on the beginning of the stream data.
        stream.write(40);
        stream.write(50);

        t.deepEqual(await stream.toArray(), [40, 50, 10, 20, 30]);
    });

    test(`Can write to first stream in a chain (one internal stream, maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });
        const transformedStream = stream
            .map(chunk => `foo${ chunk }`)
            .map(chunk => ({ value: chunk }));

        stream.write(10);
        stream.write(20);
        stream.write(30);

        stream.end();

        t.deepEqual(await transformedStream.toArray(), [{ value: "foo10" }, { value: "foo20" }, { value: "foo30" }]);
    });

    test(`Can write to first stream in a chain (multiple internal streams, maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });
        const transformedStream = stream
            .map(chunk => `foo${ chunk }`)
            .batch(chunk => chunk.endsWith("1"))
            .map(chunk => chunk.join(""))
            .map(chunk => ({ value: chunk }));

        stream.write(10);
        stream.write(11);
        stream.write(20);
        stream.write(21);
        stream.write(30);

        const result = await Promise.all([transformedStream.read(), transformedStream.read()]);

        t.deepEqual(result, [{ value: "foo10foo11" }, { value: "foo20foo21" }]);
    });

    test(`Can write to first stream in a chain (multiple internal streams, toArray, maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });
        const transformedStream = stream
            .map(chunk => `foo${ chunk }`)
            .batch(chunk => chunk.endsWith("1"))
            .map(chunk => chunk.join(""))
            .map(chunk => ({ value: chunk }));

        stream.write(10);
        stream.write(11);
        stream.write(20);
        stream.write(21);
        stream.write(30);

        stream.end();

        t.deepEqual(await transformedStream.toArray(), [{ value: "foo10foo11" }, { value: "foo20foo21" }, { value: "foo30" }]);
    });

    test(`Can write to first stream in a chain (multiple internal streams, read more than written, maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });
        const transformedStream = stream
            .map(chunk => `foo${ chunk }`)
            .batch(chunk => chunk.endsWith("1"))
            .map(chunk => chunk.join(""))
            .map(chunk => ({ value: chunk }));

        stream.write(10);
        stream.write(11);
        stream.write(20);
        stream.write(21);
        stream.write(30);

        // batch will wati for next "...1" or stream end to emit last piece
        stream.end();

        const result = await Promise.all([
            transformedStream.read(), transformedStream.read(), transformedStream.read(), transformedStream.read()]);

        t.deepEqual(result, [{ value: "foo10foo11" }, { value: "foo20foo21" }, { value: "foo30" }, null]);
    });

    test(`Can write to last stream in a chain (one internal stream, maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel })
            .map(chunk => `foo${ chunk }`)
            .map(chunk => ({ value: chunk }));

        stream.write(10);
        stream.write(20);
        stream.write(30);

        stream.end();

        t.deepEqual(await stream.toArray(), [{ value: "foo10" }, { value: "foo20" }, { value: "foo30" }]);
    });

    test(`Can write to last stream in a chain (multiple internal streams, read more, maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel })
            .map(chunk => `foo${ chunk }`)
            .batch(chunk => chunk.endsWith("1"))
            .map(chunk => chunk.join(""))
            .map(chunk => ({ value: chunk }));

        stream.write(10);
        stream.write(11);
        stream.write(20);
        stream.write(21);
        stream.write(30);

        stream.end();

        t.deepEqual(await stream.toArray(), [{ value: "foo10foo11" }, { value: "foo20foo21" }, { value: "foo30" }]);
    });


    test(`Can write to any stream in a chain (multiple internal streams, maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });
        const streamMap1 = stream.map(chunk => `foo${ chunk }`);
        const streamBatch1 = streamMap1.batch(chunk => chunk.endsWith("1"));
        const streamMap2 = streamBatch1.map(chunk => chunk.join(""));
        const streamFlatMap = streamMap2.flatMap(chunk => ([{ value: chunk }, { value: "flat" }]));

        // Creation order
        stream.write(10);
        streamMap1.write(11);
        streamBatch1.write(20);
        streamMap2.write(21);
        streamFlatMap.write(30);

        // Reverse order
        streamFlatMap.write(31);
        streamMap2.write(32);
        streamBatch1.write(33);
        streamMap1.write(41);
        stream.write(42);

        stream.end();

        t.deepEqual(await streamFlatMap.toArray(), [
            { value: "foo10foo11" }, { value: "flat" },
            { value: "foo20foo21" }, { value: "flat" },
            { value: "foo30foo31" }, { value: "flat" },
            { value: "foo32foo33foo41" }, { value: "flat" },
            { value: "foo42" }, { value: "flat" },
        ]);
    });
}

test("Throws error when writing to closed stream", async (t) => {
    const stream = new DataStream<number>();

    await stream.end();

    t.throws(() => stream.write(4), { message: "Write after end" });
});

test("Throws error when writing to any closed stream", async (t) => {
    const stream = new DataStream<number>()
        .map(chunk => `foo${ chunk }`);
    const stream2 = stream.batch(chunk => chunk.endsWith("1"))
        .map(chunk => chunk.join(""))
        .map(chunk => ({ value: chunk }));

    await stream.end();

    t.throws(() => stream2.write(4), { message: "Write after end" });
});
