import test from "ava";
import { IFCA } from "../lib/test";

type Dict = { [k: string]: number; };


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
        if (a % 2) await defer(2000, out);
        return out;
    };
    const syncPromiseTransform = ({ a, n, x }: Dict) => ({ a, n, x, y: y++ });
    const syncPromiseTransform2 = ({ a, n, x, y }: Dict) => ({ a, n, x, y, z: z++ });

    const ifca = new IFCA(MAX_PARALLEL, asyncPromiseTransform)
        .addTransform(syncPromiseTransform)
        .addTransform(syncPromiseTransform2)
        ;

    const out: Dict[] = [];

    t.true(typeof ifca.write(input[0]) === "undefined", "Initial entry should resolve immediately");
    console.log(ifca.status);
    await defer(10);
    console.log(ifca.status);
    const item1 = ifca.read();
    console.log(ifca.status);
    t.false(item1 instanceof Promise, "Not a promise.");
    t.deepEqual(item1 as unknown as Dict, { a: 0, n: 0, x: 0, y: 0, z: 0 }, "Initial entry should be read")
    // t.true(typeof ifca.write(input[0]) === "undefined", "Initial entry should resolve immediately");
    
    // while (out.length < ELEMENTS) {
    //     const result = await ifca.read(ELEMENTS);
    //     out.push(...result);
    // }

    /**
     * Expected result (old algorithm)
     * ```
     * Running with:  { MAX_PARALLEL: 8, ELEMENTS: 16 }
     * { a: 0, n: 0, x: 0, y: 0, z: 0 }
     * { a: 1, n: 1, x: 5, y: 5, z: 5 }
     * { a: 2, n: 0, x: 1, y: 1, z: 1 }
     * { a: 3, n: 1, x: 7, y: 7, z: 7 }
     * { a: 4, n: 0, x: 2, y: 2, z: 2 }
     * { a: 5, n: 1, x: 9, y: 9, z: 9 }
     * { a: 6, n: 0, x: 3, y: 3, z: 3 }
     * { a: 7, n: 1, x: 11, y: 11, z: 11 }
     * { a: 8, n: 0, x: 4, y: 4, z: 4 }
     * { a: 9, n: 1, x: 12, y: 12, z: 12 }
     * { a: 10, n: 0, x: 6, y: 6, z: 6 }
     * { a: 11, n: 1, x: 13, y: 13, z: 13 }
     * { a: 12, n: 0, x: 8, y: 8, z: 8 }
     * { a: 13, n: 1, x: 14, y: 14, z: 14 }
     * { a: 14, n: 0, x: 10, y: 10, z: 10 }
     * { a: 15, n: 1, x: 15, y: 15, z: 15 }
     * ```
     */

    let b = 0;
    console.error(out);
    for await (const result of out) {
        t.is(result.a, b++, "Should work in order");
        t.is(result.y, result.z, "Should work in order");
        t.is(result.x, result.y, "Should work out of order");
        if (result.a > MAX_PARALLEL / 2 && result.a !== ELEMENTS - 1)
            t.not(result.a, result.x, `Should not be chained ${result.a}, ${result.x}`);
    }
});

