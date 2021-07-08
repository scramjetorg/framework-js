import test from "ava";
import { IFCA } from "../lib/ifca";
import { defer } from "../utils"

/**
 * How many items can be waiting to be flushed
 */
const MAX_PARALLEL = 8;

test("OaL", async (t) => {
    let sum: bigint = BigInt(0);
    let cnt = BigInt(0);

    const ifca = new IFCA(MAX_PARALLEL, ({i}: {i: number}) => ({i, ts: process.hrtime.bigint()}))
        .addTransform(({i, ts}) => ({ i, latency: process.hrtime.bigint() - ts }))
    ;

    await Promise.all([
        (async () => {
            for (let i = 0; i < 300; i++) {
                const ret = ifca.write({i: i+1});
                // console.log("write", {i}, ifca.status, ret instanceof Promise);
                await Promise.all([ret, defer(1)]);
            }
            ifca.end();
        })(),
        (async () => {
            await defer(10);
            let i = 0;
            while(++i) {
                const data = await ifca.read();
                if (data === null) {
                    return;
                }
                if (data.i !== i) throw new Error(`i=${i} expected, got ${data.i} instread`);

                cnt++;
                sum += data.latency;
            }
        })()
    ]);

    const latency = Number(sum * BigInt(1e6) / cnt ) / 1e6;
    t.log("Latency:", latency);
    t.false(latency > 1e4, "Latency does not exceed 10us");
    t.pass();
});