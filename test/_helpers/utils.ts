import { IFCA } from "../../src/ifca";
import { DroppedChunk } from "../../src/types";

/**
 * Helper function that defers and optionaly returns given output after waiting.
 *
 * @param {number} ts Number of milliseconds to wait
 * @param {Object} [out] Optional output
 * @returns {Promise} Promise resolved after given timoeut
 */
async function defer<X extends any | undefined>(ts: number, out?: X): Promise<X | void> {
    return new Promise((res) => setTimeout(() => res(out), ts));
}

async function deferReturn<X extends any>(ts: number, out: X): Promise<X> {
    return new Promise((res) => setTimeout(() => res(out), ts));
}

function writeInput(ifca: IFCA<any, any, any>, input: any[]): void {
    for (const i of input) {
        ifca.write(i);
    }
}

async function readNTimes(ifca: IFCA<any, any, any>, numberOfReads: number): Promise<any[]> {
    const reads = [];

    for (let i = 0; i < numberOfReads; i++) {
        reads.push(await ifca.read());
    }

    return reads;
}

async function readNTimesConcurrently(ifca: IFCA<any, any, any>, numberOfReads: number): Promise<any[]> {
    const reads = [];

    for (let i = 0; i < numberOfReads; i++) {
        reads.push(ifca.read());
    }

    return Promise.all(reads);
}

const transforms = {
    identity: (x: number) => x,
    prepend: (x: string) => `foo-${x}`,
    delay: async (x: number) => defer(x * 5, x),
    delayOdd: async (x: number) => { return x % 2 === 1 ? await defer(10 + x, x) : x; },
    filter: (x: number) => x % 2 ? x : DroppedChunk,
    filterAsync: async (x: number) => { await defer(5); return Promise.resolve(x % 2 ? x : DroppedChunk); },
    filterAll: () => DroppedChunk,
    logger: (into: any[]) => { return (x: number) => { into.push(x); return x; }; },
    loggerAsync: (into: any[]) => {
        return async (x: number) => {
            await defer(5);
            into.push(x);
            return Promise.resolve(x);
        };
    }
};

export {
    defer,
    deferReturn,
    writeInput,
    readNTimes,
    readNTimesConcurrently,
    transforms
};
