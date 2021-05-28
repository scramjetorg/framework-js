const test = require("ava");
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

test("PTS", async (t) => {
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
        if (!(a % 2)) return { a, n: 0, x: x++ };
        return new Promise((res) => setTimeout(() => res({ a, n: 1, x: x++ }), 2000));
    };
    const syncPromiseTransform = ({ a, n, x }) => ({ a, n, x, y: y++ });
    const syncPromiseTransform2 = ({ a, n, x, y }) => ({ a, n, x, y, z: z++ });

    console.log("Running with: ", { MAX_PARALLEL, ELEMENTS });

    const str = new Readable.from(input).pipe(getStreamInOrderPTS(asyncPromiseTransform, MAX_PARALLEL));
    pushTransformToStreamPTS(str, syncPromiseTransform);

    pushTransformToStreamPTS(str, syncPromiseTransform2);

    let b = 0;
    for await (const result of str) {
        console.error(result);
        t.is(result.a, b++, "Should work in order");
        t.is(result.y, result.z, "Should work in order");
        t.is(result.x, result.y, "Should work out of order");
        if (result.a > MAX_PARALLEL / 2 && result.a !== ELEMENTS - 1)
            t.not(result.a, result.x, `Should not be chained ${result.a}, ${result.x}`);
    }
});
