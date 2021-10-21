/* eslint-disable */
import test from "ava";
import { IFCA, TransformFunction } from "../../src/ifca";
import { defer } from "../../src/utils"

type Dict = { [k: string]: number; };

/**
 * Helper function that checks if passed argument is a promise.
 *
 * @param {Object} x Obejct to be checked
 * @returns {Boolean}
 */
const isPromise = (x: any) => typeof x !== "undefined" && typeof x.then === "function";

test("PTS", async (t) => {

    /**
     * How many items can be waiting to be flushed
     */
    const MAX_PARALLEL = 8;

    /**
     * How many elements should be tested
     */
    const ELEMENTS = 16;

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
        .addTransform(syncPromiseTransform2);

    const writeNext = () => {
        const ref = input.shift();
        if (!ref) throw new Error("End of input");
        return ifca.write(ref);
    };

    t.false(isPromise(writeNext()), "Synchronous entry should resolve write immediately");
    await defer(10);
    const item1 = ifca.read(); // {"a":0,"n":0,"x":0,"y":0,"z":0}
    t.false(isPromise(item1), "Not a promise.");

    t.deepEqual(item1 as unknown as Dict, { a: 0, n: 0, x: 0, y: 0, z: 0 }, "Initial entry should be read immediately")
    t.false(isPromise(writeNext()), "1st entry should resolve write immediately");
    t.false(isPromise(writeNext()), "2nd entry should resolve write immediately");
    t.false(isPromise(writeNext()), "3rd entry should resolve write immediately");
    t.false(isPromise(writeNext()), "4th entry should resolve write immediately");
    t.false(isPromise(writeNext()), "5th entry should resolve write immediately");
    t.false(isPromise(writeNext()), "6th entry should resolve write immediately");
    t.false(isPromise(writeNext()), "7th entry should resolve write immediately");
    t.true(isPromise(writeNext()), "8th entry should fill up max parallel");

    // 8 chunks pending
    t.deepEqual(ifca.state, {pending: 8});

    // TODO: make this go 8 items beyond
    const item2 = ifca.read(); // {a: 1}
    const item3 = ifca.read(); // {a: 2}
    t.true(isPromise(item2), "Is a promise.");
    t.true(isPromise(item3), "Is a promise.");

    // 8 chunks pending (still since we haven't await on read() call)
    t.deepEqual(ifca.state, {pending: 8});

    await defer(20);
    // 8 chunks pending
    t.deepEqual(ifca.state, {pending: 8});

    t.true(isPromise(ifca.read()), "Is a promise."); // read {a: 3}.

    await defer(100);
    // All chunks should be processed by now.
    t.deepEqual(ifca.state, {pending: 0});

    t.false(isPromise(writeNext()), "After reading should allow to write immediately again"); // write {a: 9}

    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];

    t.deepEqual(read8[0], { a:4, n: 0, x: 4, y: 2, z: 2 }, "Reads the 4 element");
    t.deepEqual(read8[4], { a:8, n: 0, x: 8, y: 4, z: 4 }, "Reads the 8 element");
    t.true(isPromise(read8[5]), "The 9 element is not resolved yet");
    t.deepEqual(await read8[5], { a:9, n: 1, x: 9, y: 9, z: 9 }, "The 9 element resolves");


    t.true(isPromise(read8[6]), "The 10 element is a promise");

    let wrote = false;
    defer(10).then(() => {
        writeNext();
        writeNext();
        ifca.end(); // without ifca.end() -> Error: Promise returned by test never resolved
        wrote = true;
    });

    t.deepEqual(await read8[6], { a:10, n: 0, x: 10, y: 10, z: 10 }, "The 10th element resolves when written");
    t.deepEqual(await read8[7], { a:11, n: 1, x: 11, y: 11, z: 11 }, "The 11th element resolves when written");

    t.true(wrote, "already wrote");

    t.is(await ifca.read(), null, "Reached the end."); // TODO: we need await since the read is resolved before end is.

    t.pass();

});

test("Simple order check", async (t) => {

    /**
     * How many items can be waiting to be flushed
     */
     const MAX_PARALLEL = 4;

     /**
      * How many elements should be tested
      */
     const ELEMENTS = 6;

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
        .addTransform(syncPromiseTransform2);

    const writeNext = () => {
        const ref = input.shift();
        if (!ref) throw new Error("End of input");
        return ifca.write(ref);
    };

    t.false(isPromise(writeNext()), "Synchronous entry should resolve write immediately");
    await defer(10);
    const item1 = ifca.read(); // {"a":0,"n":0,"x":0,"y":0,"z":0}

    t.false(isPromise(item1), "Not a promise.");
    t.deepEqual(item1 as unknown as Dict, { a: 0, n: 0, x: 0, y: 0, z: 0 }, "Initial entry should be read immediately");

    t.false(isPromise(writeNext()), "1st entry should resolve write immediately");
    t.false(isPromise(writeNext()), "2nd entry should resolve write immediately");
    t.false(isPromise(writeNext()), "3rd entry should resolve write immediately");
    t.true(isPromise(writeNext()), "4th entry should fill up max parallel"); // As MAX_PARALLEL = 4 and we have 4 items in the queue.
    t.true(isPromise(writeNext()), "5th entry should should return promise as it's above max parallel");

    const item2 = ifca.read(); // {"a":1,"n":1,"x":1,"y":3,"z":3}
    const item3 = ifca.read(); // {"a":2,"n":0,"x":2,"y":1,"z":1}
    const item4 = ifca.read(); // {"a":3,"n":1,"x":3,"y":4,"z":4}
    const item5 = ifca.read(); // {"a":4,"n":0,"x":4,"y":2,"z":2}
    const item6 = ifca.read(); // {"a":5,"n":1,"x":5,"y":5,"z":5}

    t.true(isPromise(item2), "Is a promise.");
    t.true(isPromise(item3), "Is a promise.");
    t.true(isPromise(item4), "Is a promise.");
    t.true(isPromise(item5), "Is a promise.");
    t.true(isPromise(item6), "Is a promise.");

    // We need to add a .md description of the following occurences where chained functions are called on items immediately, not waiting for previous resolutions of the same function.
    t.deepEqual(await item2 as unknown as Dict, { a: 1, n: 1, x: 1, y: 3, z: 3 }, "Queueing does not occur on async element");
    t.deepEqual(await item3 as unknown as Dict, { a: 2, n: 0, x: 2, y: 1, z: 1 }, "Queueing does not occur on sync element");
    t.deepEqual(await item4 as unknown as Dict, { a: 3, n: 1, x: 3, y: 4, z: 4 }, "Queueing does not occur on async element");
    t.deepEqual(await item5 as unknown as Dict, { a: 4, n: 0, x: 4, y: 2, z: 2 }, "Queueing does not occur on sync element");
    t.deepEqual(await item6 as unknown as Dict, { a: 5, n: 1, x: 5, y: 5, z: 5 }, "Overflowing element is in sync again");
});
