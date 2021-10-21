const assert = require("assert");
const { Given, When, Then } = require("@cucumber/cucumber");

Given("no initial conditions", () => {
    console.log("no initial conditions");
});

When("I ask whether it works", () => {
    this.actualAnswer = "It works!";
    console.log("I ask whether it works");
});

Then("I should be told {string}", (expectedAnswer) => {
    assert.strictEqual(this.actualAnswer, expectedAnswer);
});
