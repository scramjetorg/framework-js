import assert from "assert";
import { Given, When, Then } from "@cucumber/cucumber";
import { StringStream } from "../../../src/streams/string-stream";

Given("I have StringStream created from", function (input) {
    this.stringStream = StringStream.from([input]);
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

Given("I have StringStream created from a file {string}", function (path) {
    this.stringStream = StringStream.fromFile<string, StringStream>(path, { readStream: { encoding: "utf8" } });
});

When("I split it into words", function () {
    const stream = this.stringStream as StringStream;
    this.stringStream = stream.split(" ");
});

When("I filter out all words longer than {int} characters", function (length) {
    const stream = this.stringStream as StringStream;
    this.stringStream = stream.filter(chunk => chunk.length <= length);
});

When("I aggregate words into sentences by {string} as sentence end", function (sentenceEnd) {
    console.log("AGGREGATE");
});
