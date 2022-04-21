import test from "ava";
import { performance } from "perf_hooks";
import { IFCA } from "../../../src/ifca";
import { defer, writeInput, readNTimes, readNTimesConcurrently, transforms } from "../../_helpers/utils";

// This file implements all the common scenarios described in
// https://github.com/scramjetorg/scramjet-framework-shared/blob/93965135ca23cb2e07dcb679280b584d5d97a906/tests/spec/ifca.md

type ObjectChunk = {id: number, startTime: number};

const sampleNumericInput1 = [0, 1, 2, 3, 4, 5];
const sampleNumericInput2 = [1, 3, 2, 6, 4, 5];
const sampleStringInput = ["a", "b", "c"];

// Basics

test("Passthrough by default", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA({ maxParallel: inputSize });

    writeInput(ifca, sampleNumericInput1);

    const results = await readNTimesConcurrently(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput1);
});

test("Simple transformation", async (t) => {
    const inputSize = sampleStringInput.length;
    const ifca = new IFCA<string, string, any>({ maxParallel: inputSize });

    ifca.addTransform(transforms.prepend);

    writeInput(ifca, sampleStringInput);

    const results = await readNTimesConcurrently(ifca, inputSize);

    t.deepEqual(results, ["foo-a", "foo-b", "foo-c"]);
});

test("Simple transformation with error handler", async (t) => {
    const inputSize = sampleStringInput.length;
    const ifca = new IFCA<string, string, any>({ maxParallel: inputSize });

    ifca.addTransform(transforms.prepend);
    ifca.addErrorHandler((err, chunk) => `CHUNK ERROR: ${err?.message} - ${chunk}`);

    writeInput(ifca, sampleStringInput);

    const results = await readNTimesConcurrently(ifca, inputSize);

    t.deepEqual(results, ["foo-a", "foo-b", "foo-c"]);
});

test("Simple async transformation with error handler", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(transforms.delay);
    ifca.addErrorHandler(async () => -1);

    writeInput(ifca, sampleNumericInput1);

    const results = await readNTimesConcurrently(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput1);
});

test("Concurrent processing", async (t) => {
    const input: Array<ObjectChunk> = [
        { id: 0, startTime: 0 },
        { id: 1, startTime: 0 },
        { id: 2, startTime: 0 },
        { id: 3, startTime: 0 }
    ];
    const inputSize = input.length;
    const ifca = new IFCA<ObjectChunk, any, any>({ maxParallel: inputSize });
    const started: Array<ObjectChunk> = [];

    let startTime: number;
    let chunkProcessingTimeSum: number = 0;
    let chunkProcessingTimeMax: number = 0;

    ifca.addTransform(async (x: ObjectChunk): Promise<ObjectChunk> => {
        x.startTime = performance.now();
        started.push(x);
        return defer(x.id * 15, x) as Promise<ObjectChunk>;
    });

    ifca.addTransform((x: ObjectChunk): ObjectChunk => {
        const processingTime = performance.now() - x.startTime;

        chunkProcessingTimeSum += processingTime;

        if (chunkProcessingTimeMax < processingTime) {
            chunkProcessingTimeMax = processingTime;
        }

        return x;
    });

    startTime = performance.now();

    writeInput(ifca, input);

    // Wait for the next tick since transforms are started asynchronously.
    await defer(0);

    t.deepEqual(started.length, inputSize, "All chunks processing should start immediately.");

    await readNTimesConcurrently(ifca, inputSize);

    const processingTime = performance.now() - startTime;
    // We assume processing time could be longer than a single chunk longest processing time of a margin of 25% only.
    const processingTimeMargin = 1.25;

    t.true(processingTime < chunkProcessingTimeSum,
        `Total processing time (${processingTime}) is lower than a sum of all chunks processing times (${chunkProcessingTimeSum}).`);

    t.true(chunkProcessingTimeMax * processingTimeMargin > processingTime,
        `Total processing time (${processingTime}) should be close to a single chunk longest processing time (${chunkProcessingTimeMax}).`);
});

// Ordering

test("Result order with odd chunks delayed", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(transforms.delayOdd);

    writeInput(ifca, sampleNumericInput1);

    const results = await readNTimes(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput1);
});

test("Result order with varying processing time", async (t) => {
    const inputSize = sampleNumericInput2.length;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(transforms.delay);

    writeInput(ifca, sampleNumericInput2);

    const results = await readNTimes(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput2);
});

test("Write and read in turn", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });
    const reads = [];

    ifca.addTransform(transforms.delay);

    for (const i of sampleNumericInput1) {
        ifca.write(i);
        reads.push(ifca.read());
    }

    const results = await Promise.all(reads);

    t.deepEqual(results, sampleNumericInput1);
});

test("Multiple concurrent reads", async (t) => {
    const inputSize = sampleNumericInput2.length;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(transforms.delay);

    writeInput(ifca, sampleNumericInput2);

    const results = await readNTimesConcurrently(ifca, inputSize);

    t.deepEqual(results, sampleNumericInput2);
});

test("Reads before writes", async (t) => {
    const inputSize = sampleNumericInput2.length;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });
    const reads = [];

    ifca.addTransform(transforms.delay);

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
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize / 2 });

    ifca.addTransform(transforms.filter);

    writeInput(ifca, input);

    const results = await readNTimesConcurrently(ifca, inputSize / 2);

    t.deepEqual(results, [1, 3, 5, 1, 3, 5]);
});

test("Reads before filtering", async (t) => {
    const input = [...sampleNumericInput1, ...sampleNumericInput2];
    const inputSize = input.length;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize / 2 });

    ifca.addTransform(transforms.filter);

    const reads = readNTimesConcurrently(ifca, inputSize / 2);

    writeInput(ifca, input);

    const results = await reads;

    t.deepEqual(results, [1, 3, 5, 1, 3, 5]);
});

test("Dropping chunks in the middle of chain", async (t) => {
    const inputSize = sampleNumericInput1.length;
    const ifca = new IFCA<number, any, any>({ maxParallel: inputSize });
    const unfilteredChunks: number[] = [];

    ifca.addTransform(transforms.filterAll);
    ifca.addTransform(transforms.logger(unfilteredChunks));

    writeInput(ifca, sampleNumericInput1);

    await ifca.end();

    t.is(unfilteredChunks.length, 0);
});

// Limits

test("Unrestricted writing below limit", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA({ maxParallel: inputSize });
    const drains = [];

    for (let i = 0; i < inputSize - 1; i++) {
        drains.push(ifca.write(i));
    }

    t.true(drains.every(drain => drain === undefined));
});

test("Drain pending when limit reached", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA({ maxParallel: inputSize });
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

    await ifca.read();

    // If read above doesn't resolve drain promise, this test will fail with timeout.
    await lastDrain;

    t.pass();
});

test("Drain resolved when drops below limit", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA({ maxParallel: inputSize });
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

test("Reading from empty Ifca", async (t) => {
    const ifca = new IFCA({ maxParallel: 2 });

    ifca.end();

    const result = await ifca.read();

    t.is(result, null);
});

test("End with pending reads", async (t) => {
    const ifca = new IFCA({ maxParallel: 2 });
    const reads = [ifca.read(), ifca.read(), ifca.read()];

    ifca.end();

    const results = await Promise.all(reads);

    t.deepEqual(results, [null, null, null]);
});

test("Write after end errors", async (t) => {
    const ifca = new IFCA({ maxParallel: 2 });

    ifca.end();

    let errorMsg = "";

    try {
        ifca.write("foo");
    } catch (err) {
        errorMsg = (err as Error).message;
    }

    t.is(errorMsg, "Write after end");
});

test("Multiple ends error", async (t) => {
    const ifca = new IFCA({ maxParallel: 2 });

    let errorMsg = "";

    try {
        ifca.end();
    } catch (err) {
        errorMsg = (err as Error).message;
    }

    t.is(errorMsg, "", "First end call does not throw error");

    try {
        ifca.end();
    } catch (err) {
        errorMsg = (err as Error).message;
    }

    t.is(errorMsg, "End called multiple times", "Second end call throws error");
});

test("Writing null chunk ends IFCA", t => {
    const ifca = new IFCA({ maxParallel: 4, ordered: true });

    ifca.write(1);

    t.false((ifca as any).ended);

    ifca.write(null);

    t.true((ifca as any).ended);
});

// Error handling

test("IFCA can register error handlers", async (t) => {
    const ifca = new IFCA({ maxParallel: 4 });
    const errorHandler = () => {};

    ifca.addErrorHandler(errorHandler);

    t.deepEqual(ifca.transformHandlers.length, 1);
    t.deepEqual(ifca.transformHandlers[0][1], errorHandler);
});

test("Simple transformation throwing error", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(() => {
        throw new Error("Sample error");
    });

    try {
        writeInput(ifca, [0, 1, 2]);
    } catch (err: any) {
        t.deepEqual(err.message, "Sample error");
    }
});

test("Error handler and simple transformation throwing error", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(() => {
        throw new Error("Sample error");
    }, (err) => {
        t.deepEqual(err?.message, "Sample error");
    });

    writeInput(ifca, [0, 1, 2]);
});

test("Simple transformation throwing undefined error", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(() => {
        // eslint-disable-next-line no-throw-literal
        throw undefined;
    });

    try {
        writeInput(ifca, [0, 1, 2]);

        const result = await ifca.read();

        t.true(result === undefined);
    } catch (err: any) {
        t.fail();
    }
});

// Error thrown here cannot be caught since the processing runs "in the background" (no await attached)
// and we lack any mechanism for passing such errors safely.
test.skip("Simple async transformation throwing error", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    try {
        ifca.addTransform(async () => {
            throw new Error("Sample error");
        });

        await ifca.write(0);

        await defer(25);
    } catch (err: any) {
        t.deepEqual(err.message, "Sample error");
    }
});

test("Error handler and simple async transformation throwing error", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(async () => {
        throw new Error("Sample error");
    }, (err) => {
        t.deepEqual(err?.message, "Sample error");
    });

    writeInput(ifca, [0, 1, 2]);

    await defer(25);
});

test("Simple async transformation throwing undefined error", async (t) => {
    const inputSize = 4;
    const ifca = new IFCA<number, number, any>({ maxParallel: inputSize });

    ifca.addTransform(async () => {
        // eslint-disable-next-line no-throw-literal
        throw undefined;
    });

    try {
        writeInput(ifca, [0, 1, 2]);

        const result = await ifca.read();

        t.true(result === undefined);
    } catch (err: any) {
        t.fail();
    }
});

// Various

test("Null chunks on the beginning are handled by writev", t => {
    const ifca = new IFCA({ maxParallel: 4, ordered: true });

    ifca.writev([null, 1, 2, 3, 4, 5, 6]);

    t.false((ifca as any).ended);
});

test("IFCA can remove (shift) transforms", async (t) => {
    const ifca = new IFCA({ maxParallel: 4 });

    ifca.addTransform((chunk) => chunk);
    ifca.addTransform((chunk) => chunk);

    t.deepEqual(ifca.transformHandlers.length, 2);

    ifca.removeTransform();

    t.deepEqual(ifca.transformHandlers.length, 1);
});

test("IFCA can handle promise chunks", async (t) => {
    const inputSize = 2;
    const ifca = new IFCA({ maxParallel: inputSize });

    writeInput(ifca, [
        new Promise(res => setTimeout(() => res(1), 5)),
        new Promise(res => setTimeout(() => res(2), 5)),
    ]);

    const results = await readNTimesConcurrently(ifca, inputSize);

    t.deepEqual(results, [1, 2]);
});
