import test from "ava";
import { IFCA } from "../lib/test";

type Dict = { [k: string]: number; };
type MaybePromise<X> = Promise<X>|X;

/**
 * How many items can be waiting to be flushed
 */
const MAX_PARALLEL = 8;

/**
 * How many elements should be tested
 */
const ELEMENTS = 16;

function defer<X extends any | undefined>(ts: number, out?: X): Promise<X | void> {
    return new Promise((res) => setTimeout(() => res(out), ts));
}

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

test("PTS", async (t) => {
    let a = 0;
    let x = 0;
    let y = 0;
    let z = 0;

    const input = Array.from(Array(ELEMENTS).keys()).map(() => {
        return { a: a++ };
    });

    const asyncPromiseTransform = async ({ a }: { a: number }) => {
        const out = { a, n: a % 2, x: x++ }
        if (a % 2) await defer(100, out);
        return out;
    };
    const syncPromiseTransform = ({ a, n, x }: Dict) => ({ a, n, x, y: y++ });
    const syncPromiseTransform2 = ({ a, n, x, y }: Dict) => ({ a, n, x, y, z: z++ });

    const ifca = new IFCA(MAX_PARALLEL, asyncPromiseTransform)
        .addTransform(syncPromiseTransform)
        .addTransform(syncPromiseTransform2)
        ;
    const writeNext = () => {
        const ref = input.shift();
        if (!ref) throw new Error("End of input");
        return ifca.write(ref);
    };
    const isPromise = (x: any) => typeof x !== "undefined" && typeof x.then === "function";

    t.false(isPromise(writeNext()), "Synchronous entry should resolve write immediately");
    await defer(10);
    const item1 = ifca.read();
    t.false(isPromise(item1), "Not a promise.");

    t.deepEqual(item1 as unknown as Dict, { a: 0, n: 0, x: 0, y: 0, z: 0 }, "Initial entry should be read immediately")
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.false(isPromise(writeNext()), "Asynchronous entry should resolve write immediately");
    t.true(isPromise(writeNext()), "Entries should fill up when it reaches the end");
    
    // TODO: make this go 8 items beyond 
    const item2 = ifca.read();
    const item3 = ifca.read();
    t.true(isPromise(item2), "Is a promise.");
    t.true(isPromise(item3), "Is a promise.");

    await defer(20);
    t.true(isPromise(ifca.read()), "Is a promise.");

    await defer(100);
    t.false(isPromise(writeNext()), "After reading should allow to write immediately again");

    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    
    t.deepEqual(read8[0], { a:4, n: 0, x: 4, y: 2, z: 2 }, "Reads the 4th element");
    t.deepEqual(read8[5], { a:9, n: 1, x: 9, y: 9, z: 9 }, "Reads the 9th element");
    t.true(isPromise(read8[6]), "The 10th element is not resolved yet");
    t.deepEqual(await read8[6], { a:10, n: 0, x: 10, y: 10, z: 10 }, "The 10th element resolves");
    
    t.true(isPromise(read8[7]), "The 11th element is a promise");

    let wrote = false;
    defer(10).then(() => {
        writeNext();
        ifca.end();
        wrote = true;
    });

    t.deepEqual(await read8[7], { a:11, n: 1, x: 11, y: 11, z: 11 }, "The 11th element resolves when written");

    t.true(wrote, "already wrote");

    t.is(ifca.read(), null, "Reached the end.");

    t.pass();

});

test("Overflow reads", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    const read8: MaybePromise<number|null>[] = [];
    for (let i = 0; i < 8; i++) {
        const ret = ifca.read();
        read8.push(ret);
        t.log("r", ifca.status, ret)
    }

    for (let i = 0; i < 8; i++) {
        ifca.write(i);
        t.log("w", ifca.status)
    }
    ifca.end();

    const results: (null|number)[] = [];
    for (const x of read8) {
        t.log(x);
        results.push(await x);
    }

    t.deepEqual(results, [1,2,3,4,5,6,7,8], "Should work well");
});

test("Overflow writes", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);
    
    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end();
    
    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read() 
    ];
    const first8 = await Promise.all(read8);

    const another8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read() 
    ];
    const second8 = await Promise.all(another8);

    const results = [...first8, ...second8];

    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12,null,null,null,null], "Should work well");
});
test("Overflow writes with read(2) lower than max parallel(4)", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);
    
    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end();

    let results:any[] = [];
    
    for (let j = 0; j < 6; j++) {
        const read2 = [ ifca.read(), ifca.read()];
        const result = await Promise.all(read2);
        results = [...results, ...result]
    }

    console.log('JSON:' + JSON.stringify(results))

    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12], "Should work well");
});