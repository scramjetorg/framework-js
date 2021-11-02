# Scramjet Framework JS/TS

## Table of contents

- [Installation](#installation)
- [Commands](#commands)
- [Publish](#publish)
- [Documentation](#documentation)

## Installation

Setup necessary tooling and install dependencies first:

### Node.js (14.x)

Refer to [official docs](https://nodejs.org/en/download/). Alternatively you may use Node version manager like [nvm](https://github.com/nvm-sh/nvm).


### Setup project

Install project dependencies:

```bash
npm i
```

## Commands

```bash
npm run build[:w]
```

Transpiles `.ts` sources and tests (`src` and `test` dirs) and outputs JS files to `build` directory. When run with `:w` it will watch for changes and rebuild automatically.

```bash
npm run test[:w]
```

Runs all tests from `test` folder. It runs `build` internally so it doesn't have to be run manually. When run with `:w` it will watch for changes, rebuild and rerun test automatically.

```bash
npm run bdd
```

Runs all BDD tests from `bdd` directory. It runs `build` internally so it doesn't have to be run manually.

```bash
npm run coverage
```

Checks code coverage, generates HTML report and serves it on 8080 port.

```bash
npm run coverage:check
```

Checks code coverage. Will fail if it is below a threshold defined in `package.json`. Useful as a CI job.

```bash
npm run coverage:generate
```

Checks code coverage and generates HTML report.

```bash
npm run coverage:[unit|bdd]
```

Generates code coverage for given set of tests. _It's a subtask and should not be run separately_.

```bash
npm run coverage:report
```

Creates coverage report based on generated coverage files from unit and bdd tests. _It's a subtask and should not be run separately_.

```bash
npm run dist
```

Builds dist files - similar to `build` but skips `test` folder and additionaly generates source maps and TS typings files.

```bash
npm run lint
```

Lints `src` and `test` dirs. Used as a `pre-commit` hook.

```bash
npm run prepare
```

Installs husky hooks. Necessary only for development. Needs to be run only once after repo checkout.

### Running single test file or specific tests

Single test file can be run by passing its path to `test` command:

```bash
npm run test -- build/test/ifca/common.spec.js
```

While specific test cases can be run using `-m` (match) option:

```bash
npm run test -- -m "*default*"
```

Both can be mixed to run specific tests from a given file or folder:

```bash
npm run test -- build/test/ifca/common.spec.js -m "*default*"
```

## Publish

**To be done** as we don't have publishing workflow in place at the moment.

## Documentation

Project structure:

* `src/` - directory with all the source code
* `test/` - directory with unit tests
* `bdd/` - directory with bdd tests
