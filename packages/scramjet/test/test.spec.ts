import test from "ava";
import { DataStream } from "../lib/index";

test("DataStream can be constructed", (t) => {
    const dsNumber = new DataStream<number>();
    const dsString = new DataStream<string>();

    t.true(dsNumber instanceof DataStream);
    t.true(dsString instanceof DataStream);
});

test("DataStream can be created via static from method", async (t) => {
    const dsNumber = DataStream.from<number>([1,2,3,4]);
    const dsString = DataStream.from<string>(['1','2','3','4']);
    const dsAny = DataStream.from([1,2,'3','4']); // Not sure how and if we want to force using generics.

    t.true(dsNumber instanceof DataStream);
    t.true(dsString instanceof DataStream);
    t.true(dsAny instanceof DataStream);
});

// can read from iterable
// can read from asynciterable
// can read from readable
