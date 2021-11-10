import assert from "assert";
import { Given, When, Then, World, IWorld } from "@cucumber/cucumber";
import { StringStream } from "../../../../src/streams/string-stream";

class Context extends World {
    public stream!: StringStream;
    public asArray!: Array<string>;
    public results!: any;
}

function getContext(context: IWorld): Context {
    return context as Context;
}

Given("I have a StringStream created from", function(input) {
    getContext(this).stream = StringStream.from([input]);
});

Given("I have a StringStream created from a file {string}", function(path) {
    getContext(this).stream = StringStream.fromFile<string, StringStream>(path, { readStream: { encoding: "utf8" } });
});

When("I call split function with EOL character", function() {
    getContext(this).stream = getContext(this).stream.split("\n");
});

Then("It should result with {int} chunks as output", async function(expectedChunksNr) {
    const context = getContext(this);

    context.asArray = await context.stream.toArray();

    assert.strictEqual(context.asArray.length, expectedChunksNr);
});

Then("Chunk nr {int} is {string}", function(chunkNr, expectedValue) {
    assert.strictEqual(getContext(this).asArray[chunkNr - 1], expectedValue);
});

When("I split it into words", function() {
    getContext(this).stream = getContext(this).stream.split(" ");
});

When("I filter out all words longer than {int} characters", function(length) {
    getContext(this).stream = getContext(this).stream.filter(chunk => chunk.length <= length);
});

When("I aggregate words into sentences by {string} as sentence end", function(sentenceEnd) {
    const context = getContext(this);

    context.stream = context.stream
        .batch(chunk => chunk.endsWith(sentenceEnd))
        .map(chunk => chunk.join(" ")) as StringStream; // Should I use somethign like sequence here?
});

When("I count average sentence length by words", async function() {
    const context = getContext(this);

    context.results = await context.stream
        .reduce((acc, chunk) => {
            acc.sentences++;
            acc.wordsAvgSum += chunk.split(" ").length;

            return acc;
        }, { sentences: 0, wordsAvgSum: 0 });

    context.results.wordsAvg = context.results.wordsAvgSum / context.results.sentences;
});

Then("It should result with {int} sentences", function(expectedSentencesNr) {
    assert.strictEqual(getContext(this).results.sentences, expectedSentencesNr);
});

Then("It should have average sentence length of {float} words", function(expectedAvgWordsNr) {
    assert.strictEqual(getContext(this).results.wordsAvg.toFixed(2), expectedAvgWordsNr.toFixed(2));
});
