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

### Yarn (3.x)

```bash
npm install -g yarn
```

### Setup project

Update yarn to 3.x version:

```bash
yarn set version berry
```

Install project dependencies:

```bash
yarn install
```

Setup husky:

```bash
yarn prepare
```

## Commands

```bash
yarn build[:w]
```

Transpiles `.ts` sources and tests (`src` and `test` dirs) and outputs JS files to `build` directory. When run with `:w` it will watch for changes and rebuild automatically.

```bash
yarn test[:w]
```

Runs all tests from `test` folder. It runs `build` internally so it doesn't have to be run manually. When run with `:w` it will watch for changes, rebuild and rerun test automatically.

```bash
yarn bdd
```

Runs all BDD tests from `bdd` directory. It runs `build` internally so it doesn't have to be run manually.

```bash
yarn coverage
```

Checks code coverage, generates HTML report and serves it on 8080 port.

```bash
yarn coverage:check
```

Checks code coverage. Will fail if it is below a threshold defined in `package.json`. Useful as a CI job.

```bash
yarn coverage:generate
```

Checks code coverage and generates HTML report.

```bash
yarn coverage:[unit|bdd]
```

Generates code coverage for given set of tests. _It's a subtask and should not be run separately_.

```bash
yarn coverage:report
```

Creates coverage report based on generated coverage files from unit and bdd tests. _It's a subtask and should not be run separately_.

```bash
yarn dist
```

Builds dist files - similar to `build` but skips `test` folder and additionaly generates source maps and TS typings files.

```bash
yarn lint
```

Lints `src` and `test` dirs. Used as a `pre-commit` hook.

```bash
yarn prepare
```

Installs husky hooks. Necessary only for development. Needs to be run only once after repo checkout.

### Running single test file or specific tests

Single test file can be run by passing its path to `test` command:

```bash
yarn test build/test/ifca/common.spec.js
```

While specific test cases can be run using `-m` (match) option:

```bash
yarn test -m "*default*"
```

Both can be mixed to run specific tests from a given file or folder:

```bash
yarn test build/test/ifca/common.spec.js -m "*default*"
```

## Publish

**To be done** as we don't have publishing workflow in place at the moment.

## Documentation

Project structure:

* `src/` - directory with all the source code
* `test/` - directory with test
