import test from "ava";
import { IFCA } from "../lib/index";
import { defer } from "../utils"

/**
 * How many items can be waiting to be flushed
 */
const MAX_PARALLEL = 8;

test("Acceptable latency test", async (t) => {
    let sum: bigint = BigInt(0);
    let cnt = BigInt(0);

    const ifca = new IFCA(MAX_PARALLEL, ({i}: {i: number}) => ({i, ts: process.hrtime.bigint()}), {strict: true})
        .addTransform(({i, ts}) => ({ i, latency: process.hrtime.bigint() - ts }))
    ;

    await Promise.all([
        (async () => {
            for (let i = 0; i < 3000; i++) {
                const ret = ifca.write({i: i+1});
                // console.log("write", {i}, ifca.status, ret instanceof Promise);
                await Promise.all([ret, defer(1)]);
            }
            ifca.end(); // TODO: test for correct end operation
        })().finally(() => console.log("Write done")),
        (async () => {
            await defer(10);
            let i = 0;
            while(++i) {
                const data = await ifca.read();
                if (data === null) {
                    console.log("data done")
                    return;
                }
                if (data.i !== i) throw new Error(`i=${i} expected, got ${data.i} instead`);

                cnt++;
                sum += data.latency;
            }
        })().finally(() => console.log("Read done"))
    ]);

    const latency = Number(sum * BigInt(1e6) / cnt ) / 1e6;
    t.log("Latency:", latency);
    t.false(latency > 1e4, "Latency does not exceed 10us");
});