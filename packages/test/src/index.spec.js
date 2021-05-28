const { IFCA } = require("./index");

/**
 * How many items can be waiting to be flushed
 */
const MAX_PARALLEL = 8;

/**
 * How many elements should be tested
 */
const ELEMENTS = 16;

const ifca = new IFCA(MAX_PARALLEL);

async function run() {
    let a = 0;
    let x = 0;
    let y = 0;
    let z = 0;

    const input = Array.from(Array(ELEMENTS).keys()).map(() => {
        return { a: a++ };
    });
    // START
    const asyncPromiseTransform = async ({ a }) => {
        console.log(a, 0);

        if (!(a % 2)) {
            const result = { a, n: 0, x };
            x++;
            console.log(a, 1, "async promise o: " + JSON.stringify(result) + " x: " + x);
            return result;
        }
        return new Promise((res) =>
            setTimeout(() => {
                const result = { a, n: 1, x };
                x++;
                console.log(a, 2, "timeout promise o: " + JSON.stringify(result) + " x: " + x);
                res(result);
            }, 2000)
        );
    };
    const syncPromiseTransform = ({ a, n, x }) => {
        const result = { a, n, x, y };
        y++;
        console.log(a, 3, "sync promise1 o: " + JSON.stringify(result) + " y: " + y);
        return result;
    };
    const syncPromiseTransform2 = ({ a, n, x, y }) => {
        const result = { a, n, x, y, z };
        z++;
        console.log(a, 4, "sync promise2 o: " + JSON.stringify(result) + " z: " + z);
        return result;
    };
    // END

    ifca.addTransform(asyncPromiseTransform).addTransform(syncPromiseTransform).addTransform(syncPromiseTransform2);

    const out = [];

    for (const chunk of input) {
        const result = await ifca.addChunk(chunk);

        // console.log("result:" + result);

        const { value } = result;

        drain = result.drain;

        // console.log("value and drain:");
        // console.log(value);
        // console.log(drain);

        if (drain) await drain;
        if (value instanceof Promise) {
            // console.log("instance of... then push");

            // value.then((data) => out.push(data));
            out.push(value);
            // TODO: error handling
        } else {
            // console.log("simply push");
            out.push(value);
        }
    }

    // out.push = await ifca.last();

    /**
     * Expected result (old algorithm)
     * ```
     * Running with:  { MAX_PARALLEL: 8, ELEMENTS: 16 }
     * { n: 0, a: 0, x: 0, y: 0, z: 0 }
     * { n: 1, a: 1, x: 5, y: 5, z: 1 }
     * { n: 0, a: 2, x: 1, y: 1, z: 2 }
     * { n: 1, a: 3, x: 7, y: 7, z: 3 }
     * { n: 0, a: 4, x: 2, y: 2, z: 4 }
     * { n: 1, a: 5, x: 9, y: 9, z: 5 }
     * { n: 0, a: 6, x: 3, y: 3, z: 6 }
     * { n: 1, a: 7, x: 11, y: 11, z: 7 }
     * { n: 0, a: 8, x: 4, y: 4, z: 8 }
     * { n: 1, a: 9, x: 12, y: 12, z: 9 }
     * { n: 0, a: 10, x: 6, y: 6, z: 10 }
     * { n: 1, a: 11, x: 13, y: 13, z: 11 }
     * { n: 0, a: 12, x: 8, y: 8, z: 12 }
     * { n: 1, a: 13, x: 14, y: 14, z: 13 }
     * { n: 0, a: 14, x: 10, y: 10, z: 14 }
     * { n: 1, a: 15, x: 15, y: 15, z: 15 }
     * ```
     */

    for (result of out) {
        console.error(await result);
    }
}

run();
