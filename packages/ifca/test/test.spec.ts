import test from "ava";
import { IFCA, TransformFunction } from "../lib/index";
import { defer } from "../utils"

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

/**
 * Helper function that checks if passed argument is a promise.
 * 
 * @param {Object} x Obejct to be checked
 * @returns {Boolean}
 */
const isPromise = (x: any) => typeof x !== "undefined" && typeof x.then === "function";

test("PTS", async (t) => {
    let a = 0;
    let x = 0;
    let y = 0;
    let z = 0;

    const input = Array.from(Array(ELEMENTS).keys()).map(() => {
        return { a: a++ };
    });

    const asyncPromiseTransform: TransformFunction<{a: number}, {[k: string]: number}> = async ({ a }: { a: number }) => {
        const out = { a, n: a % 2, x: x++ }
        if (a % 2) await defer(100, out);
        return out;
    };
    const syncPromiseTransform = ({ a, n, x }: Dict) => ({ a, n, x, y: y++ });
    const syncPromiseTransform2 = ({ a, n, x, y }: Dict) => ({ a, n, x, y, z: z++ });

    const ifca = new IFCA(MAX_PARALLEL, asyncPromiseTransform, {strict: true})
        .addTransform(syncPromiseTransform)
        .addTransform(syncPromiseTransform2)
        ;
    const writeNext = () => {
        const ref = input.shift();
        if (!ref) throw new Error("End of input");
        return ifca.write(ref);
    };

    t.false(isPromise(writeNext()), "Synchronous entry should resolve write immediately");
    await defer(10);
    const item1 = ifca.read();
    t.false(isPromise(item1), "Not a promise.");

    t.deepEqual(item1 as unknown as Dict, { a: 0, n: 0, x: 0, y: 0, z: 0 }, "Initial entry should be read immediately")
    t.false(isPromise(writeNext()), "1st entry should resolve write immediately");
    t.false(isPromise(writeNext()), "2nd entry should resolve write immediately");
    t.false(isPromise(writeNext()), "3rd entry should resolve write immediately");
    t.false(isPromise(writeNext()), "4th entry should resolve write immediately");
    t.false(isPromise(writeNext()), "5th entry should resolve write immediately");
    t.false(isPromise(writeNext()), "6th entry should resolve write immediately");
    t.false(isPromise(writeNext()), "7th entry should resolve write immediately");
    t.false(isPromise(writeNext()), "8th entry should resolve write immediately");
    t.true(isPromise(writeNext()), "9th entry should fill up max parallel");
    
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

    t.is(await ifca.read(), null, "Reached the end."); // TODO: we need await since the read is resolved before end is.

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

test("Overflow writes. Read 8 x 2", async (t) => {
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

test("Overflow writes Write: 5x Read: 3x Max Parallel: 2", async(t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 5; i++) {
        ifca.write(i);
    }
    ifca.end();

    const read3 = [ifca.read(), ifca.read(), ifca.read()];
    const first3 = await Promise.all(read3);
    const results = [...first3];
    t.deepEqual(results, [1,2,3]);
})

// Same as above.
test("Overflow writes. Read 7x + read 9x", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end();

    const read7 = [ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()];
    t.log(read7);
    const first7 = await Promise.all(read7);

    const another9 = [ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()];
    const second9 = [];
    for (const next of another9) {
        const val = await next;
        t.log(val, ifca.status);
        second9.push(val);
    }

    const results = [...first7, ...second9];
    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12,null,null,null,null], "Should work well");
});

test("Overflow writes. Read 4x", async (t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }
    ifca.end();

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read4);

    t.deepEqual(results, [1,2,3,4], "Should work well");
});


// This used to work. Now I've got: Error: Promise returned by test never resolved
test("Overflow writes. Read 12x", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end();

    const read12 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read12);

    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12], "Should work well");
});

test("Write. Read. Write. Read", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }

    const read4 = [ ifca.read(), ifca.read(), ifca.read(), ifca.read() ];
    
    for (let i = 4; i < 8; i++) {
        ifca.write(i);
    }
    ifca.end();

    const another4 = [ ifca.read(), ifca.read(), ifca.read(), ifca.read() ];

    const first4 = await Promise.all(read4);
    const second4 = await Promise.all(another4);

    const results = [...first4, ...second4];

    t.deepEqual(results, [1,2,3,4,5,6,7,8], "Should work well");

});

// Works okay now
test("Overflow writes with read 2x (lower than max parallel(4)) repeated 6 times", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);
    
    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end();

    let results:any[] = [];
    
    for (let j = 0; j < 6; j++) {
        const read2 = [ ifca.read(), ifca.read() ];
        const result = await Promise.all(read2);
        results = [...results, ...result]
    }
    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12], "Should work well");
});