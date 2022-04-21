#!/usr/bin/env node
// Ignore TypeScript constructs (like decorator local functions) in coverage reports.

const { join } = require("path");
const { readFileSync, writeFileSync } = require("fs");

const files = [
    "build/src/streams/data-stream.js",
    "build/src/streams/string-stream.js",
    "build/src/streams/proxies/stream-node-writable-proxy.js"
];

const replacements = [
    "var __decorate = (",
    "var __metadata = (",
    "var __asyncValues = (",
    "var __importDefault = (",
    [/__decorate\(\[/g, "__decorate(["]
];

for (const file of files) {
    const filePath = join(__dirname, "..", file);
    const fileContents = readFileSync(filePath, "utf8");

    console.log(`coverage-ignore: Processing ${filePath}`);

    let newContents = fileContents;

    for (const replacement of replacements) {
        if (Array.isArray(replacement)) {
            newContents = newContents.replace(replacement[0], `/* istanbul ignore next */\n${replacement[1]}`);
        } else {
            newContents = newContents.replace(replacement, `/* istanbul ignore next */\n${replacement}`);
        }
    }

    writeFileSync(filePath, newContents);
}
