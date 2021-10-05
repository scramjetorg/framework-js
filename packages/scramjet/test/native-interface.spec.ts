import test from "ava";
import { DataStream } from "../lib/data-stream";

test("DataStream can be iterated with 'for await..of'", async (t) => {
    const result = [];
    const dsString = DataStream
        .from<string>(["1", "2", "3", "4", "5", "6"])
        .map<number>(parseInt, 10)
        .filter(chunk => !!(chunk % 2));


    for await (const chunk of dsString) {
        result.push(chunk);
    }

    t.deepEqual(result, [1, 3, 5]);
});

test.skip("DataStream can be piped to Readable node stream", () => {
    // const dsNumber = DataStream.from<number>([1, 2, 3, 4, 5]);
});
