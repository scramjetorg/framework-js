const assert = require("assert");
const { PromiseTranformStream } = require("../lib/promise-transform-stream-ifca");

const gen = function* () {
    let i = 0;
    while (i < 100) yield { a: i++ };
};

const databaseSave = () => new Promise((res) => setTimeout(res, 100));

const str = new PromiseTranformStream(
    { read: gen } // TODO: Add
)
    .addTransform((x) => (x.a % 2 ? x : undefined))
    .addTransform((x) => ({ b: x.a }))
    .addTransform((x) => {
        if (x.b % 10 === 7) throw new Error("This should be handled"); // 7 and 17 throws Error

        return x;
    })
    .addHandler((err, x) => {
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
(async () => {
    let items = [];
    try {
        for await (const chunk of str) {
            items.push(chunk.b);
        }
    } catch {
        assert.deepStrictEqual(items, [1, 3, 5, 9, 11, 13, 15, 17, 19]); // 21 will go to the next catch
    }
})().catch((e) => {
    process.exitCode = 10;
    console.error(e.stack);
});
