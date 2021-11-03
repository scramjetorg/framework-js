import assert from "assert";
import { Given, When, Then } from "@cucumber/cucumber";
import { StringStream } from "../../../src/streams/string-stream";

Given("I have StringStream created from", function (input) {
    this.stringStream = StringStream.from([input]) as StringStream;
});

When("I call split function with EOL character", function () {
    this.stringStream = this.stringStream.split("\n");
});

Then("It should result with {int} chunks as output", async function (expectedChunksNr) {
    const result = await this.stringStream.toArray();
    this.result = result;

    assert.strictEqual(result.length, expectedChunksNr);
});

Then("Chunk nr {int} is {string}", function (chunkNr, expectedValue) {
    assert.strictEqual(this.result[chunkNr - 1], expectedValue);
});
