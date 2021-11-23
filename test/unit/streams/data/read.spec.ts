import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";

for (const maxParallel of [1, 2, 4, 8]) {
    test(`Can read from stream which was written to (maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });

        stream.write(10);
        stream.write(20);
        stream.write(30);

        const result = await Promise.all([stream.read(), stream.read(), stream.read()]);

        t.deepEqual(result, [10, 20, 30]);
    });

    test(`Can read from ended stream which was written to (maxParallel: ${ maxParallel })`, async (t) => {
        const stream = new DataStream<number>({ maxParallel });

        stream.write(10);
        stream.write(20);
        stream.write(30);

        stream.end();

        const result = await Promise.all([stream.read(), stream.read(), stream.read()]);

        t.deepEqual(result, [10, 20, 30]);
    });

    test(`Can read from stream created with from (maxParallel: ${ maxParallel })`, async (t) => {
        const stream = DataStream.from([10, 20, 30, 40, 50], { maxParallel });
        const result = await Promise.all([stream.read(), stream.read(), stream.read(), stream.read()]);

        t.deepEqual(result, [10, 20, 30, 40]);
    });

    test(`Can read from transformed stream (maxParallel: ${ maxParallel })`, async (t) => {
        const stream = DataStream.from([10, 11, 20, 21, 22, 30], { maxParallel })
            .map(chunk => `foo${ chunk }`)
            .batch(chunk => chunk.endsWith("1"))
            .map(chunk => chunk.join(""))
            .map(chunk => ({ value: chunk }));
        const result = await Promise.all([stream.read(), stream.read(), stream.read(), stream.read()]);

        t.deepEqual(result,
            [{ value: "foo10foo11" }, { value: "foo20foo21" }, { value: "foo22foo30" }, null]);
    });
}

test("Reading from intermediate streams throws an error (first stream)", async (t) => {
    const stream = new DataStream<number>()
        .map(chunk => `foo${ chunk }`);

    stream.batch(chunk => chunk.endsWith("1"))
        .map(chunk => chunk.join(""))
        .map(chunk => ({ value: chunk }));

    t.throws(() => stream.read(), { message: "Stream is not readable." });
});

test("Reading from intermediate streams throws an error (middle stream)", async (t) => {
    const stream = new DataStream<number>()
        .map(chunk => `foo${ chunk }`);
    const stream2 = stream.batch(chunk => chunk.endsWith("1"))
        .map(chunk => chunk.join(""));

    stream2.map(chunk => ({ value: chunk }));

    t.throws(() => stream.read(), { message: "Stream is not readable." });
});
