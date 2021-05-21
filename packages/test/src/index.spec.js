const { IFCA } = require("./index");

// const x: IFCA<string, string> = null as any;
const x = new IFCA(1);

// let y = x.addTransform((str) => ({ x: +str })).addTransform(({ x }) => x);

let y = x.addTransform((str) => ({ x: +str })).addTransform(({ x }) => x);

const data = ["1", "2", "3", "4"];
const out = [];

async function run() {
    let drain = Promise.resolve(true);

    for (const chunk of data) {
        const result = await y.addChunk(chunk, drain); // Resolve first Promise immediatelly

        console.log("result:" + result);

        const { value } = result;

        drain = result.drain;

        console.log("value and drain:");
        console.log(value);
        console.log(drain);

        if (drain) await drain;
        if (value instanceof Promise) {
            console.log("instance of... then push");

            value.then((data) => out.push(data));
            // TODO: error handling
        } else {
            console.log("simply push");
            out.push(value);
        }
    }

    out.push = await y.last();

    console.log("OUT: " + JSON.stringify(out));
}

run();
