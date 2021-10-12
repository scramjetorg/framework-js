import test from "ava";
import { IFCA } from "../../src/ifca";
import { writeInput, readX, transforms } from "../helpers/utils";

// This file implements all the common scenarios described in
// https://github.com/scramjetorg/scramjet-framework-shared/blob/93965135ca23cb2e07dcb679280b584d5d97a906/tests/spec/ifca.md

const sampleNumericInput = [0, 1, 2, 3];
const sampleStringInput = ["a", "b", "c"];

test("Passthrough by default", async (t) => {
    const ifca = new IFCA(4);

    writeInput(ifca, sampleNumericInput);

    const results = await readX(ifca, 4);

    t.deepEqual(results, sampleNumericInput);
});

test("Simple transformation", async (t) => {
    const ifca = new IFCA(4, transforms.prepend);

    writeInput(ifca, sampleStringInput);

    const results = await readX(ifca, 3);

    t.deepEqual(results, ["foo-a", "foo-b", "foo-c"]);
});
