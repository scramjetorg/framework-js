// const test = require("ava");
const { Readable } = require("stream");

function pushTransformToStreamPTS(str, promiseTransform) {
    str.pushTransform({
        promiseTransform,
    });
}

function getStreamInOrderPTS(promiseTransform, maxParallel) {
    const { PromiseTransformStream } = require("../lib/promise-transform-stream");

    return new PromiseTransformStream({
        maxParallel,
        promiseTransform,
    });
}

// test("PTS", async (t) => {
async function run() {
    let a = 0;
    let x = 0;
    let y = 0;
    let z = 0;

    /**
     * How many elements should be tested
     */
    const ELEMENTS = 16;
    /**
     * How many items can be waiting to be flushed
     */
    const MAX_PARALLEL = 8;

    const input = Array.from(Array(ELEMENTS).keys()).map(() => {
        return { a: a++ };
    });
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

    console.log("Running with: ", { MAX_PARALLEL, ELEMENTS });

    const str = new Readable.from(input).pipe(getStreamInOrderPTS(asyncPromiseTransform, MAX_PARALLEL));
    pushTransformToStreamPTS(str, syncPromiseTransform);

    pushTransformToStreamPTS(str, syncPromiseTransform2);

    // const str2 = str.pipe(getStreamInOrderPTS(syncPromiseTransform2));

    let b = 0;
    for await (const x of str) {
        console.error(x);
        // console.log(x);
        // t.is(x.a, b++, "Should work in order");
        // t.is(x.a, x.z, "Should work in order");
        // t.is(x.x, x.y, "Should work out of order");
        // SKIP: if (x.a > MAX_PARALLEL / 2 && x.a < ELEMENTS - MAX_PARALLEL) strictEqual(x.x, x.a + MAX_PARALLEL / 2, "Should be out of order by maxParallel");
        // if (x.a > MAX_PARALLEL / 2 && x.a !== ELEMENTS - 1) t.not(x.a, x.x, `Should not be chained ${x.a}, ${x.x}`);
    }
    // });
}

run();
