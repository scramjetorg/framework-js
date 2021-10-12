import { IFCA, DroppedChunk } from "../../src/ifca";

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

function writeInput(ifca: IFCA<any, any, any>, input: any[]): void {
    for (const i of input) {
        ifca.write(i);
    }
}

async function readX(ifca: IFCA<any, any, any>, numberOfReads: number): Promise<any[]> {
    const reads = [];

    for (let i = 0; i < numberOfReads; i++) {
        reads.push(ifca.read());
    }

    return Promise.all(reads);
}

const transforms = {
    initial: (x: number) => x,
    prepend: (x: string) => `foo-${x}`,
    filter: (x: number) => x % 2 ? x : DroppedChunk,
    filterAsync: async (x: number) => { await defer(2); return Promise.resolve(x % 2 ? x : DroppedChunk); },
    logger: (into: any[]) => { return (x: number) => { into.push(x); return x; }; },
    loggerAsync: (into: any[]) => {
        return async (x: number) => {
            await defer(2);
            into.push(x);
            return Promise.resolve(x);
        };
    }
};

export {
    defer,
    writeInput,
    readX,
    transforms
};
