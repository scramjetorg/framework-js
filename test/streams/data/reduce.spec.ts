import test from "ava";
import { DataStream } from "../../../src/streams/data-stream";

test("DataStream reduce can be use to calculate sum", async (t) => {
    const result = await DataStream
        .from([1, 2, 3, 4, 0, 0, 20, 10, 2, 2])
        .reduce((a, b) => a + b);

    t.deepEqual(result, 44);
});

test("DataStream reduce can be use to calculate sum (initial provided)", async (t) => {
    const result = await DataStream
        .from([1, 2, 3, 4, 0, 0, 20, 10, 2, 2])
        .reduce((a, b) => a + b, 0);

    t.deepEqual(result, 44);
});

test("DataStream reduce can be use to concate numbers to string", async (t) => {
    const result = await DataStream
        .from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0])
        .reduce((a, b) => `${a}${b}`, "");

    t.deepEqual(result, "1234567890");
});

// Tests below inspired by:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#examples

test("DataStream can sum values in an object stream", async (t) => {
    const result = await DataStream
        .from([{ x: 1 }, { x: 2 }, { x: 3 }])
        .reduce((a, b) => a + b.x, 0);

    t.deepEqual(result, 6);
});

test("DataStream can flatten a stream of arrays (explicit inital)", async (t) => {
    const initial: number[] = [];
    const result = await DataStream
        .from([[0, 1], [2, 3], [4, 5]])
        .reduce((a, b) => a.concat(b), initial);

    t.deepEqual(result, [0, 1, 2, 3, 4, 5]);
});

test("DataStream can flatten a stream of arrays (explicit type)", async (t) => {
    const result = await DataStream
        .from([[0, 1], [2, 3], [4, 5]])
        .reduce<number[]>((a, b) => a.concat(b), []);

    t.deepEqual(result, [0, 1, 2, 3, 4, 5]);
});

test("DataStream can count instances of values in an object stream", async (t) => {
    const initial: any = {};
    const result = await DataStream
        .from(["Alice", "Bob", "Tiff", "Bruce", "Alice"])
        .reduce((allNames, name) => {
            if (name in allNames) {
                allNames[name]++;
            } else {
                allNames[name] = 1;
            }

            return allNames;
        }, initial);

    t.deepEqual(result, { Alice: 2, Bob: 1, Tiff: 1, Bruce: 1 });
});
