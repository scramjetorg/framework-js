const { IFCA } = require("./index");

// const x: IFCA<string, string> = null as any;
const x = new IFCA(1, []);

let y = x.addTransform((str) => ({ x: +str })).addTransform(({ x }) => x);
const data = ["1", "2", "3", "4"];
const out = [];

async function run() {
    for (const chunk of data) {
        const { value, drain } = y.addChunk(chunk);

        if (drain) await drain;
        if (value instanceof Promise) {
            value.then((data) => out.push(data));
            // TODO: error handling
        } else {
            out.push(value);
        }
    }

    await y.last();
}

run();
