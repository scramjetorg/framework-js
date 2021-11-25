import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";
import { StringStream } from "../../../../src/streams/string-stream";

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
    test(`DataStream can be piped to another DataStream ${ maxParallel.slice(0, 2) }`, async (t) => {
        const dsNumber = DataStream.from([1, 2, 3, 4, 5, 6, 7], { maxParallel: maxParallel[0] });
        const dest = new DataStream<number, number>({ maxParallel: maxParallel[1] });

        dsNumber.pipe(dest);

        t.deepEqual(await dest.toArray(), [1, 2, 3, 4, 5, 6, 7]);
    });

    test(`DataStream with transforms can be piped to another DataStream ${ maxParallel.slice(0, 2) }`, async (t) => {
        const dsNumber = DataStream.from([1, 2, 3, 4, 5], { maxParallel: maxParallel[0] });
        const dest = new DataStream<number, number>({ maxParallel: maxParallel[1] });

        dsNumber.map((x) => x * 2).pipe(dest);

        t.deepEqual(await dest.toArray(), [2, 4, 6, 8, 10]);
    });

    test(`DataStream can be piped to another DataStream with transforms ${ maxParallel.slice(0, 2) }`, async (t) => {
        const dsNumber = DataStream.from([1, 2, 3, 4, 5], { maxParallel: maxParallel[0] });
        const dest = new DataStream<number, number>({ maxParallel: maxParallel[1] }).map((x) => x * 2);

        dsNumber.pipe(dest);

        t.deepEqual(await dest.toArray(), [2, 4, 6, 8, 10]);
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
}

// TODO Test cases:
// ends piped stream
// doesn't end piped stream
// pipe with write, not from
// pipe with streams transformed through flatMap/batch
// how fast chunks are piped (keeping backpressure)
// reading from piped stream (should be allowed, but may yield unexpected results)
