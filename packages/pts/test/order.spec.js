const { strictEqual, notStrictEqual } = require("assert");
const { Readable } = require("stream");

function pushTransformToStreamPTS(str, promiseTransform) {
    str.pushTransform({
        promiseTransform
    });
}

function getStreamInOrderPTS(promiseTransform, maxParallel) {
    const {PromiseTransformStream} = require("../lib/promise-transform-stream");

    return new PromiseTransformStream({
        maxParallel,
        promiseTransform
    });
}

const test = (async (pushTransformToStream, getStreamInOrder) => {

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
        return {a: a++};
    });
    const asyncPromiseTransform = async ({ a }) => {
        if (!(a % 2)) return { a, n: 0, x: x++ };
        return new Promise(res => setTimeout(() => res({ a, n: 1, x: x++ }), 200));
    };
    const syncPromiseTransform = ({a, n, x}) => ({a, n, x, y: y++});
    const syncPromiseTransform2 = ({a, n, x, y}) => ({n, a, x, y, z: z++});

    console.log("Running with: ", { MAX_PARALLEL, ELEMENTS })

    const str = new Readable.from(input)
        .pipe(getStreamInOrder(asyncPromiseTransform, MAX_PARALLEL))
    ;

        pushTransformToStream(str, syncPromiseTransform);

    const str2 = str.pipe(getStreamInOrder(syncPromiseTransform2));

    let b = 0;
    for await (const x of str2) {
        console.log(x);

        strictEqual(x.a, b++, "Should work in order");
        strictEqual(x.a, x.z, "Should work in order");
        strictEqual(x.x, x.y, "Should work out of order");
            
        // SKIP: if (x.a > MAX_PARALLEL / 2 && x.a < ELEMENTS - MAX_PARALLEL) strictEqual(x.x, x.a + MAX_PARALLEL / 2, "Should be out of order by maxParallel");

        if (x.a > MAX_PARALLEL / 2 && x.a !== ELEMENTS - 1) notStrictEqual(x.a, x.x, `Should not be chained ${x.a}, ${x.x}`);
    }

});

test(pushTransformToStreamPTS, getStreamInOrderPTS);

