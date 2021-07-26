const test = require("ava");
const { PromiseTransformStream } = require("../lib/promise-transform-stream-ifca");

/**
 * How many items can be waiting to be flushed
 */
const MAX_PARALLEL = 8;

const gen = function* () {
    let i = 0;
    while (i < 25) yield { a: i++ };
};

const databaseSave = () => new Promise((res) => setTimeout(res, 100));

test("Error Handler", async (t) => {
    const str = new PromiseTransformStream({
        read: gen,
        maxParallel: MAX_PARALLEL,
        promiseTransform: (x) => (x.a % 2 ? x : 0), // If 0 is undefined then the next transform gives: TypeError: Cannot read property 'a' of undefined
    })
        .addTransform((x) => ({ b: x.a }))
        .addTransform((x) => {
            if (x.b % 10 === 7) {
                console.log("HANDLE ERROR");
                throw new Error("This should be handled"); // 7 and 17 throws Error
            }
            console.log("ADD TRANSFORM RETURN x: " + JSON.stringify(x));

            return x;
        })
        .addErrorHandler((err, x) => {
            // TODO: Add addHandler
            if (x.b === 7 || x.b === 21) return undefined;
            throw err;
        })
        .addTransform(
            (x) => {
                if (x.b === 17) throw new Error("This should be handled");
                if (x.b === 21) throw new Error("This should not be handled");
            },
            (err, x) => {
                if (x.b === 17) return x;
                throw err;
            } // TODO: add.
            // Only applies to if (x.b === 17) throw new Error("This should be handled");
            // This drills down to IFCA to add such an option.
        )
        .addTransform((x) => databaseSave(x));

    let items = [];
    try {
        for await (const chunk of str) {
            console.log("FOR AWAIT chunk: " + JSON.stringify(chunk));
            items.push(chunk);
        }
    } catch (e) {
        console.log(e);
        console.log(items);
        t.deepEqual(items, [1, 3, 5, 9, 11, 13, 15, 17, 19]); // 21 will go to the next catch
    }
});
