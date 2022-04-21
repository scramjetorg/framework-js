#!/usr/bin/env node
// Prepares README.md file for npm publishing and copies it to dist/ folder.

const { join } = require("path");
const { readFileSync, writeFileSync } = require("fs");

const readmePath = join(__dirname, "..", "README.md");
const readmeContents = readFileSync(readmePath, "utf8");

let newContents = readmeContents;

newContents = newContents.replace(/<!-- DEV_ONLY_START -->(\s|.)*?<!-- DEV_ONLY_END -->/g, "");
newContents = newContents.replace("- [Development Setup](#development-setup)", "");

writeFileSync(join(__dirname, "../dist/", "README.md"), newContents);
