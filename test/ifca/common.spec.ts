import test from "ava";
import { IFCA } from "../../src/ifca";

// This file implements all the common scenarios described in
// https://github.com/scramjetorg/scramjet-framework-shared/blob/93965135ca23cb2e07dcb679280b584d5d97a906/tests/spec/ifca.md

const sampleNumericInput = [0, 1, 2, 3];

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

test("Passthrough by default", async (t) => {
    const ifca = new IFCA(4);

    writeInput(ifca, sampleNumericInput);

    const results = await readX(ifca, 4);

    t.deepEqual(results, sampleNumericInput);
});
