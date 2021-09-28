import chalk from "chalk";
import { DataStream } from "../packages/scramjet/lib/data-stream";

// transformations

function echo(x: any) {
    console.log(chalk.green(`Start processing: ${ x.trim() }`));
    return x.trim();
}

async function isEven(x: any) {
    await sleep((x%5)/10);
    return x % 2 == 0;
}

async function square(x: any) {
    await sleep((x%5)/10);
    return x**2;
}

// helpers

async function sleep(ms: number): Promise<void> {
    return new Promise( res => setTimeout(res, ms));
}

// test cases

(async() => {
    const inFile = process.argv[2];
    const outFile = process.argv[3];

    await DataStream
        .fromFile(inFile)
        .map(echo)
        .map(parseInt)
        .filter(isEven)
        .map(square)
        .map(x => `${ x }`)
        .toFile(outFile);
})();

