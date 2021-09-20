import test from "ava";
import { DataStream } from "../lib/index";

test("DataStream can filter chunks via sync callback", async (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4,5,6,7]);

    const result = await dsNumber.filter(chunk => !!(chunk%2)).toArray();

    t.deepEqual(result, [1,3,5,7]);
});

test("DataStream can filter chunks via async callback", async (t) => {
    const dsNumber = DataStream.from<string>(['foo','bar','baz','bax']);

    const result = await dsNumber.filter(chunk => {
        return new Promise( res => {
            setTimeout(() => {
                res(!!chunk.startsWith('b'));
            }, 10);
        });
    }).toArray();

    t.deepEqual(result, ['bar','baz','bax']);
});
