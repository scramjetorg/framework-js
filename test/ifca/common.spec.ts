import test from "ava";
import { performance } from "perf_hooks";
import { IFCA } from "../../src/ifca";
import { defer, writeInput, readX, readAwaitX, transforms } from "../helpers/utils";

// This file implements all the common scenarios described in
// https://github.com/scramjetorg/scramjet-framework-shared/blob/93965135ca23cb2e07dcb679280b584d5d97a906/tests/spec/ifca.md

type ObjectChunk = {id: number, time: number};

const sampleNumericInput1 = [0, 1, 2, 3, 4, 5];
const sampleNumericInput2 = [1, 3, 2, 6, 4, 5];
const sampleStringInput = ["a", "b", "c"];
const sampleObjectInput: Array<ObjectChunk> = [
    { id: 0, time: 0 }, { id: 1, time: 0 }, { id: 2, time: 0 }, { id: 3, time: 0 }
];

// Basics

test("Passthrough by default", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA(inputSize);

    writeInput(ifca, sampleNumericInput1);

    const results = await readX(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput1);
});

test("Simple transformation", async (t) => {
    const inputSize = sampleStringInput.length;
    const ifca = new IFCA(inputSize, transforms.prepend);

    writeInput(ifca, sampleStringInput);

    const results = await readX(ifca, inputSize);

    t.deepEqual(results, ["foo-a", "foo-b", "foo-c"]);
});

test("Concurrent processing", async (t) => {
    const inputSize = sampleObjectInput.length;
    const ifca = new IFCA<ObjectChunk, any, any>(inputSize);
    const started: Array<ObjectChunk> = [];

    let startTime: number;
    let chunkProcessingTimeSum: number = 0;
    let chunkProcessingTimeMax: number = 0;

    ifca.addTransform(async (x: ObjectChunk): Promise<ObjectChunk> => {
        started.push(x);
        return defer(x.id * 15, x) as Promise<ObjectChunk>;
    });

    ifca.addTransform((x: ObjectChunk): ObjectChunk => {
        x.time = performance.now() - startTime;
        chunkProcessingTimeSum += x.time;

        if (chunkProcessingTimeMax < x.time) {
            chunkProcessingTimeMax = x.time;
        }

        return x;
    });

    startTime = performance.now();

    writeInput(ifca, sampleObjectInput);

    // Wait for the next tick since transforms are started asynchronously.
    await defer(0);

    t.deepEqual(started.length, inputSize, "All chunks processing should start immediately.");

    await readX(ifca, inputSize);

    const processingTime = performance.now() - startTime;
    const processingTimeMargin = 1.1; // We assume processing time could be longer than a single chunk longest processing time of a margin of 10% only.

    t.true(processingTime < chunkProcessingTimeSum, "Processing time is lower than a sum of all chunks processing time");
    t.true(chunkProcessingTimeMax * processingTimeMargin > processingTime, "Total processing time should be close to a single chunk longest processing time");
});

// Ordering

test("Result order with odd chunks delayed", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA(inputSize, transforms.delayOdd);

    writeInput(ifca, sampleNumericInput1);

    const results = await readAwaitX(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput1);
});

test("Result order with varying processing time", async (t) => {
    const inputSize = sampleNumericInput2.length;
    const ifca = new IFCA(inputSize, transforms.delay);

    writeInput(ifca, sampleNumericInput2);

    const results = await readAwaitX(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput2);
});

test("Write and read in turn", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA(inputSize, transforms.delay);
    const reads = [];

    for (const i of sampleNumericInput1) {
        ifca.write(i);
        reads.push(ifca.read());
    }

    const results = await Promise.all(reads);

    t.deepEqual(results, sampleNumericInput1);
});

test("Multiple concurrent reads", async (t) => {
    const inputSize = sampleNumericInput2.length;
    const ifca = new IFCA(inputSize, transforms.delay);

    writeInput(ifca, sampleNumericInput2);

    const results = await readX(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput2);
});

test("Reads before writes", async (t) => {
    const inputSize = sampleNumericInput2.length;
    const ifca = new IFCA(inputSize, transforms.delay);
    const reads = [];

    for (let i = 0; i < inputSize; i++) {
        reads.push(ifca.read());
    }

    t.true(reads.every(item => item instanceof Promise), "Each read result should be an awaitable.  ");

    writeInput(ifca, sampleNumericInput2);

    const results = await Promise.all(reads);

    t.deepEqual(results, sampleNumericInput2);
});

// Filtering

test("Support for dropping chunks", async (t) => {
    const input = [...sampleNumericInput1, ...sampleNumericInput2];
    const inputSize = input.length;
    const ifca = new IFCA(inputSize / 2, transforms.filter);

    writeInput(ifca, input);

    const results = await readX(ifca, inputSize / 2);

    t.deepEqual(results, [1, 3, 5, 1, 3, 5]);
});

test("Reads before filtering", async (t) => {
    const input = [...sampleNumericInput1, ...sampleNumericInput2];
    const inputSize = input.length;
    const ifca = new IFCA(inputSize / 2, transforms.filter);
    const reads = readX(ifca, inputSize / 2);

    writeInput(ifca, input);

    const results = await reads;

    t.deepEqual(results, [1, 3, 5, 1, 3, 5]);
});

test("Dropping chunks in the middle of chain", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA<number, any, any>(inputSize);
    const unfilteredChunks: number[] = [];

    ifca.addTransform(transforms.filterAll);
    ifca.addTransform(transforms.logger(unfilteredChunks));

    writeInput(ifca, sampleNumericInput1);

    await ifca.end();

    t.true(unfilteredChunks.length === 0);
});

// Limits

test("Unrestricted writing below limit", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA(inputSize);
    const drains = [];

    for (let i = 0; i < inputSize - 1; i++) {
        drains.push(ifca.write(i));
    }

    t.true(drains.every(drain => drain === undefined));
});

test("Drain pending when limit reached", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA(inputSize);
    const drains = [];

    for (let i = 0; i < inputSize; i++) {
        drains.push(ifca.write(i));
    }

    const lastDrain = drains.pop() as Promise<void>;

    let lastDrainResolved = false;

    lastDrain.then(() => {
        lastDrainResolved = true;
    });

    t.true(drains.every(drain => drain === undefined), "Drain values up to N write calls are plain values.");
    t.true(lastDrain instanceof Promise, "Drain value of N write call is awaitable.");

    // Wait a bit to make sure drain promise is still pending.
    await defer(10);

    t.false(lastDrainResolved, "Drain value of N write call is pending.");
});

test("Drain resolved when drops below limit", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA(inputSize);
    const drains = [];
    const awaitingDrains: Array<Promise<void>> = [];

    for (let i = 0; i < inputSize + 2; i++) {
        if (i >= inputSize - 1) {
            awaitingDrains.push(ifca.write(i) as Promise<void>);
        } else {
            drains.push(ifca.write(i));
        }
    }

    t.true(drains.every(drain => drain === undefined), "Drain values up to N write calls are plain values.");
    t.true(awaitingDrains.every(drain => drain instanceof Promise), "Drain values starting from Nth write call are awaitables.");

    await Promise.all([ifca.read(), ifca.read(), ifca.read()]);

    // If reads above doesn't resolve drain promise, this test will fail with timeout.
    await Promise.all(awaitingDrains);

    t.pass();
});

// Ending
