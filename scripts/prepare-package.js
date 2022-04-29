#!/usr/bin/env node
// Prepares package.json file for npm publishing and copies it to dist/ folder.

const { join } = require("path");
const { readFileSync, writeFileSync } = require("fs");

const packagePath = join(__dirname, "..", "package.json");
const packageContents = readFileSync(packagePath, "utf8");

const { name, version, description, author, license, keywords } = JSON.parse(packageContents);
const newPackage = {
    name,
    version,
    description,
    main: "index.js",
    author,
    license,
    keywords
};

writeFileSync(join(__dirname, "../dist/", "package.json"), JSON.stringify(newPackage, null, "  "));
