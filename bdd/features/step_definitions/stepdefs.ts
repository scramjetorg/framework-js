import assert from "assert";
import { Given, When, Then } from "@cucumber/cucumber";
import { DataStream } from "../../../src/streams/data-stream";

Given("I have DataStream of type {string} created from", function (dataStreamType, input) {
    if ( dataStreamType === 'string') {
        this.dataStream = DataStream.from<string>([input]);
    }
});

When("I call split function with {string} param", function (splitBy) {
    this.dataStream.split(splitBy);
});

Then("It should result with {int} chunks as output", async function (expectedChunksNr) {
    const result = await this.dataStream.toArray();
    this.result = result;

    assert.strictEqual(result.length, expectedChunksNr);
});

Then("Chunk nr {int} is {string}", function (chunkNr, expectedValue) {
    assert.strictEqual(this.result[chunkNr], expectedValue);
});
