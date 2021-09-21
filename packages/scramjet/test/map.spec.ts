import test from "ava";
import { DataStream } from "../lib/index";

test("DataStream can map chunks via sync callback (to same type)", async (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4,5]);

    const result = await dsNumber.map<number>(chunk => chunk*2).toArray();

    t.deepEqual(result, [2,4,6,8,10]);
});

test("DataStream can map chunks via sync callback (to different type)", async (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4,5]);

    const result = await dsNumber.map<string>(chunk => `foo-${chunk}`).toArray();

    t.deepEqual(result, ['foo-1','foo-2','foo-3','foo-4','foo-5']);
});

test("DataStream can map chunks via async callback (to same type)", async (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4,5]);

    const result = await dsNumber.map<number>(chunk => {
        return new Promise( res => {
            setTimeout(() => {
                res(chunk*2);
            }, 10);
        });
    }).toArray();

    t.deepEqual(result, [2,4,6,8,10]);
});

test("DataStream can map chunks via async callback (to different type)", async (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4,5]);

    const result = await dsNumber.map<string>(chunk => {
        return new Promise( res => {
            setTimeout(() => {
                res(`foo-${chunk}`);
            }, 10);
        });
    }).toArray();

    t.deepEqual(result, ['foo-1','foo-2','foo-3','foo-4','foo-5']);
});

test("DataStream can apply multiple map transforms", async (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4,5]);

    const result = await dsNumber
        .map<number>(chunk => chunk*2)
        .map<string>(chunk => {
            return new Promise( res => {
                setTimeout(() => {
                    res(`${chunk}00`);
                }, 10);
            });
        })
        .map<number>(chunk => parseInt(chunk))
        .toArray();

    t.deepEqual(result, [200,400,600,800,1000]);
});
