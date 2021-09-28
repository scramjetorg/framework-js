import test from "ava";
import { DataStream } from "../lib/data-stream";

test("DataStream can filter chunks via sync callback", async (t) => {
    const dsNumber = DataStream.from<number>([1, 2, 3, 4, 5, 6, 7]);
    const result = await dsNumber.filter(chunk => !!(chunk%2)).toArray();

    t.deepEqual(result, [1, 3, 5, 7]);
});

test("DataStream can filter chunks via async callback", async (t) => {
    const dsNumber = DataStream.from<string>(["foo", "bar", "baz", "bax"]);
    const result = await dsNumber.filter(async chunk => {
        return new Promise(res => {
            setTimeout(() => {
                res(!!chunk.startsWith("b"));
            }, 10);
        });
    }).toArray();

    t.deepEqual(result, ["bar", "baz", "bax"]);
});

test("DataStream can apply multiple filter transforms", async (t) => {
    const dsString = DataStream.from<string>(["1", "2", "3", "4", "10", "20", "30", "40", "100", "200", "300", "400"]);
    const result = await dsString
        .filter(chunk => chunk.length < 3)
        .filter(async chunk => {
            return new Promise(res => {
                setTimeout(() => {
                    res(!!(chunk.startsWith("1") || chunk.startsWith("2") || chunk.startsWith("3")));
                }, 10);
            });
        })
        .filter(chunk => chunk.length === 2)
        .toArray();

    t.deepEqual(result, ["10", "20", "30"]);
});
