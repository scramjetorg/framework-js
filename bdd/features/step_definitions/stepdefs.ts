import assert from "assert";
import { Given, When, Then } from "@cucumber/cucumber";

const context = {
    actualAnswer: ""
};

Given("I have {DataStream} of type {String}", () => {
    console.log("no initial conditions");
});

When("I ask whether it works", () => {
    context.actualAnswer = "It works!";
    console.log("I ask whether it works");
});

Then("I should be told {string}", (expectedAnswer) => {
    assert.strictEqual(context.actualAnswer, expectedAnswer);
});
