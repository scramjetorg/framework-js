import test from "ava";
import { IFCA, TransformFunction } from "../lib/index";
import { defer } from "../utils"

type Dict = { [k: string]: number; };

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
        ifca.end(); // without ifca.end() -> Error: Promise returned by test never resolved
        wrote = true;
    });

    t.deepEqual(await read8[7], { a:11, n: 1, x: 11, y: 11, z: 11 }, "The 11th element resolves when written");

    t.true(wrote, "already wrote");

    t.is(await ifca.read(), null, "Reached the end."); // TODO: we need await since the read is resolved before end is.

    t.pass();

});
