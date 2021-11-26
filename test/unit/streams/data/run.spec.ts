import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";

test("DataStream run consumes entire stream", async (t) => {
    const result: number[] = [];

    await DataStream
        .from([1, 2, 3, 4, 0, 0, 20, 10, 2, 2])
        .map(x => { result.push(x); return x; })
        .run();

    t.deepEqual(result, [1, 2, 3, 4, 0, 0, 20, 10, 2, 2]);
});
