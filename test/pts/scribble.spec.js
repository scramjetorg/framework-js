const test = require("ava");
const { PromiseTransformStream } = require("./helpers/promise-transform-stream-ifca");

/**
 * How many items can be waiting to be flushed
 */
const MAX_PARALLEL = 8;

const gen = function* () {
    let i = 0;
    while (i < 25) yield { a: i++ };
};

const databaseSave = (x) => {
    console.log("DATABASE SAVE x: " + JSON.stringify(x));
    return new Promise((res) => setTimeout(res(x.b), 100));
};

test.skip("Error Handler", async (t) => {
    const str = new PromiseTransformStream({
        read: gen,
        maxParallel: MAX_PARALLEL,
        promiseTransform: (x) => (x.a % 2 ? x : Promise.reject(undefined)),
    })
        // If undefined don't move to the next step
        .addTransform((x) => {
            console.log("TRANSFORM - remove undefined: x: ");
            console.log(x);
            return {
                b: x.a,
            };
        })
        .addTransform((x) => {
            if (x.b % 10 === 7) {
                console.log("HANDLE ERROR");
                throw new Error("This should be handled"); // 7 and 17 throws Error
            }
            console.log("SECOND TRANSFORM RETURN x: " + JSON.stringify(x));

            return x;
        })
        .addErrorHandler((err, x) => {
            // TODO: Add addHandler
            console.log("ERROR HANDLER x: " + JSON.stringify(x) + " err: " + JSON.stringify(err));
            if (x.a === 7 || x.a === 21) return Promise.reject(undefined);
            if (err) throw err;
        })
        .addTransform(
            (x) => {
                console.log("ANOTHER TRANSFORM x: " + JSON.stringify(x));
                if (x.b === 17) throw new Error("This should be handled");
                if (x.b === 21) throw new Error("This should not be handled");
                return x;
            },
            (err, x) => {
                if (x.a === 17) return x;
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
        t.fail("Should throw error on 21");
    } catch (e) {
        // TypeError: Cannot set property 'cause' of undefined - remove that element completely
        console.log(e);
        console.log(items);
        t.deepEqual(items, [1, 3, 5, 9, 11, 13, 15, 17, 19]); // 21 will go to the next catch
    }
});
