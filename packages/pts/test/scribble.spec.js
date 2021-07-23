const test = require("ava");
const { PromiseTransformStream } = require("../lib/promise-transform-stream-ifca");

/**
 * How many items can be waiting to be flushed
 */
const MAX_PARALLEL = 8;

const gen = function* () {
    let i = 0;
    while (i < 100) yield { a: i++ };
};

const databaseSave = () => new Promise((res) => setTimeout(res, 100));

test("Error Handler", async (t) => {
    const str = new PromiseTransformStream(
        { read: gen, maxParallel: MAX_PARALLEL, promiseTransform: (x) => (x.a % 2 ? x : undefined) } // TODO: Add
    )
        .addTransform((x) => ({ b: x.a }))
        .addTransform((x) => {
            if (x.b % 10 === 7) throw new Error("This should be handled"); // 7 and 17 throws Error

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
    // .getStreamAdapter(gen);
    // .getStreamAdapter();
    let items = [];
    const generator = str.getGenerator(1000);
    // const generator = str.next(); // OKAYISH...
    try {
        for await (const chunk of generator) {
            console.log("FOR AWAIT chunk: " + JSON.stringify(chunk));
            items.push(chunk);
        }
    } catch (e) {
        console.log(e);
        console.log(items);
        t.deepEqual(items, [1, 3, 5, 9, 11, 13, 15, 17, 19]); // 21 will go to the next catch
    }
});
