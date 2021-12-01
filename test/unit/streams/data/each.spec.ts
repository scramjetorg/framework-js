import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";
import { defer } from "../../../_helpers/utils";

test("DataStream each runs for every chunk in correct order (sync)", async (t) => {
    const result: number[] = [];
    const stream = DataStream
        .from([1, 2, 3, 4, 5, 6])
        .each(chunk => { result.push(chunk); });

    t.deepEqual(await stream.toArray(), [1, 2, 3, 4, 5, 6]);
    t.deepEqual(result, [1, 2, 3, 4, 5, 6]);
});

test("DataStream each runs for every chunk in correct order (async)", async (t) => {
    const result: number[] = [];
    const stream = DataStream
        .from([3, 2, 1, 6, 4, 5])
        .each(async (chunk, timeout) => { result.push(chunk); await defer(chunk * timeout); }, 10);

    t.deepEqual(await stream.toArray(), [3, 2, 1, 6, 4, 5]);
    t.deepEqual(result, [3, 2, 1, 6, 4, 5]);
});
