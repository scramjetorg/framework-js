Scramjet Framework TypeScript
==================
<p align="center">
    <a href="https://badge.fury.io/js/@scramjet%2Fframework">
        <img src="https://badge.fury.io/js/@scramjet%2Fframework.svg" alt="npm version" height="18">
    </a>
    <a><img src="https://github.com/scramjetorg/framework-js/actions/workflows/test.yml/badge.svg?branch=main" alt="Tests" /></a>
    <a href="https://snyk.io/test/github/scramjetorg/framework-js">
        <img src="https://snyk.io/test/github/scramjetorg/framework-js/badge.svg" alt="Known Vulnerabilities" />
    </a>
    <a><img src="https://img.shields.io/github/license/scramjetorg/framework-js?color=green&style=plastic" alt="License" /></a>
    <a><img src="https://img.shields.io/github/v/tag/scramjetorg/framework-js?label=version&color=blue&style=plastic" alt="Version" /></a>
    <a><img src="https://img.shields.io/github/stars/scramjetorg/framework-js?color=pink&style=plastic" alt="GitHub stars" /></a>
    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=7F7V65C43EBMW">
        <img src="https://img.shields.io/badge/Donate-PayPal-green.svg?color=yellow&style=plastic" alt="Donate" />
    </a>
</p>
<p align="center">⭐ Star us on GitHub — it motivates us a lot! 🚀 </p>
<p align="center">
    <img src="https://assets.scramjet.org/images/framework-logo-256.svg" width="420" alt="Scramjet Framework">
</p>

Scramjet is a simple reactive stream programming framework. The code is written by chaining functions that transform the streamed data, including well known map, filter and reduce.

The main advantage of Scramjet is running asynchronous operations on your data streams concurrently. It allows you to perform the transformations both synchronously and asynchronously by using the same API - so now you can "map" your stream from whatever source and call any number of API's consecutively.

This is a pre-release of the next major version (v5) of [JavaScript Scramjet Framework](https://www.npmjs.com/package/scramjet).

**We are open to your feedback!** We encourage you to report issues with any ideas, suggestions and features you would like to see in this version. You can also upvote (`+1`) existing ones to show us the direction we should take in developing Scramjet Framework.

**Not interested in JavaScript/TypeScript version?** Check out [Scramjet Framework in Python](https://github.com/scramjetorg/framework-python)!

## Table of contents

- [Installation](#installation)
- [Usage](#usage)
- [Requesting features](#requesting-features)
- [Reporting bugs](#reporting-bugs)
- [Contributing](#contributing)


## Installation

Simply run:

```bash
npm i @scramjet/framework
```

And then you can require it in the JS/TS code like:

_sample-file.ts_
```ts
import { DataStream } from "@scramjet/framework";
```



## Usage

Scramjet streams are similar and behave similar to native nodejs streams and to streams in any programing language in general. They allow operating on streams of data (were each separate data part is called a `chunk`) and process it in any way through transforms like mapping or filtering.

Let's take a look on how to create and operate on Scramjet streams.

_If you would like to dive deeper, please refer to [streams source files](https://github.com/scramjetorg/framework-js/tree/main/src/streams)_.

### Creating Scramjet streams

The basic method for creating Scramjet streams is `from()` static method. It accepts iterables (both sync and async) and native nodejs streams. As for iterables it can be a simple array, generator or anything iterable:

```ts
import { DataStream } from "scramjet";

const stream = DataStream.from(["foo", "bar", "baz"]);
```

Scramjet streams are asynchronous iterables itself, which means one stream can be created from another:

```ts
import { DataStream } from "scramjet";

const stream1 = DataStream.from(["foo", "bar", "baz"]);
const stream2 = DataStream.from(stream1);
```

They can be also created from native nodejs `Readable`s:

```ts
import { createReadStream } from "fs";
import { DataStream } from "scramjet";

const stream = DataStream.from(createReadStream("path/to/file"));
```

The more "manual" approach is creating streams using constructor:

```ts
import { DataStream } from "scramjet";

const stream = new DataStream();
```

Such approach is useful when one needs to manually write data to a stream or use it as a pipe destination:

```ts
import { DataStream } from "scramjet";

const stream = new DataStream();
stream.write("foo");

const stream2 = new DataStream();
stream.pipe(stream2);
```

### Getting data from Scramjet streams

Similar as to creating Scramjet streams, there are specific methods which allow getting data out of them. Those are sometimes called `sink` methods as they allow data to flow through and out of the stream. As those methods needs to wait for the stream end, they return a `Promise` which needs to be awaited and is resolved when all data from source is processed.

```ts
import { DataStream } from "scramjet";

const stream1 = DataStream.from(["foo", "bar", "baz"]);
await stream1.toArray(); // ["foo", "bar", "baz"]

const stream2 = DataStream.from(["foo", "bar", "baz"]);
await stream2.toFile("path/to/file"); // Writes to a file, resolves when done.

const stream3 = DataStream.from(["foo", "bar", "baz"]);
await stream3.reduce(
    (prev, curr) => `${ prev }-${ curr }`,
    ""
); // "foo-bar-baz"
```

As Scramjet streams are asynchronous iterables they can be iterated too:

```ts
import { DataStream } from "scramjet";

const stream = DataStream.from(["foo", "bar", "baz"]);

for await (const chunk of stream) {
    console.log(chunk);
}
// Logs:
// "foo"
// "bar"
// "baz"
```

Similar to writing, there is also more "manual" way of reading from streams using `.read()` method:

```ts
import { DataStream } from "scramjet";

const stream = DataStream.from(["foo", "bar", "baz"]);

await stream.read(); // "foo"
await stream.read(); // "bar"
```

Read returns a `Promise` which waits until there is something ready to be read from a stream.

### Basic operations

The whole idea of stream processing is an ability to quickly and efficiently transform data which flows through the stream. Let's take a look at basic operations (called `transforms`) and what they do:

#### Mapping

Mapping stream data is basically the same as mapping an array. It allows to map a `chunk` to a new value:

```ts
import { DataStream } from "scramjet";

DataStream
    .from(["foo", "bar", "baz"])
    .map(chunk => chunk.repeat(2))
    .toArray(); // ["foofoo", "barbar", "bazbaz"]
```

The result of the map transform could be of different type than initial chunks:

```ts
import { DataStream } from "scramjet";

DataStream
    .from(["foo", "bar", "baz"])
    .map(chunk => chunk.charCodeAt(0))
    .toArray(); // [102, 98, 98]

DataStream
    .from(["foo", "bar", "baz"])
    .map(chunk => chunk.split(""))
    .toArray(); // [["f", "o", "o"], ["b", "a", "r"], ["b", "a", "z"]]
```

#### Filtering

Filtering allows to filter out any unnecessary chunks:

```ts
import { DataStream } from "scramjet";

DataStream
    .from([1, 2, 3, 4, 5, 6])
    .filter(chunk => chunk % 2 === 0)
    .toArray(); // [2, 4, 6]
```

#### Grouping

Batching allows to group chunks into arrays, effectively changing chunks number flowing though the stream:

```ts
import { DataStream } from "scramjet";

DataStream
    .from([1, 2, 3, 4, 5, 6, 7, 8])
    .batch(chunk => chunk % 2 === 0)
    .toArray(); // [[1, 2], [3, 4], [5, 6], [7, 8]]
```

Whenever callback function passed to `.batch()` call returns `true`, new group is emitted.

#### Flattening

Operation opposite to batching is flattening. At the moment, Scramjet streams provides `.flatMap()` method which allows first to map chunks and then flatten the resulting arrays:

```ts
import { DataStream } from "scramjet";

DataStream
    .from(["foo", "bar", "baz"])
    .flatMap(chunk => chunk.split(""))
    .toArray(); // ["f", "o", "o", "b", "a", "r", "b", "a", "z"]
```

But it can be also used to only flatten the stream by providing a callback which only passes values through:

```ts
import { DataStream } from "scramjet";

DataStream
    .from([1, 2, 3, 4, 5, 6, 7, 8])
    .batch(chunk => chunk % 2 === 0)
    .flatMap(chunk => chunk)
    .toArray(); // [1, 2, 3, 4, 5, 6, 7, 8]
```

#### Piping

Piping is essential for operating on streams. Scramjet streams can be both used as pipe source and destination. They can be also combined with native nodejs streams having native streams as pipe source or destination.

```ts
import { DataStream } from "scramjet";

const stream1 = DataStream.from([1, 2, 3, 4, 5, 6, 7, 8]);
const stream2 = new DataStream();

stream1.pipe(stream2); // All data flowing through "stream1" will be passed to "stream2".
```

```ts
import { createReadStream } from "fs";
import { DataStream } from "scramjet";

const readStream = createReadStream("path/to/file"));
const scramjetStream = new DataStream();

readStream.pipe(scramjetStream); // All file contents read by native nodejs stream will be passed to "scramjetStream".
```

```ts
import { createWriteStream } from "fs";
import { DataStream } from "scramjet";

const scramjetStream = DataStream.from([1, 2, 3, 4, 5, 6, 7, 8]);

scramjetStream.pipe(createWriteStream("path/to/file")); // All data flowing through "scramjetStream" will be written to a file via native nodejs stream.
```

## Requesting Features

Anything missing? Or maybe there is something which would make using Scramjet Framework much easier or efficient? Don't hesitate to fill up a [new feature request](https://github.com/scramjetorg/framework-js/issues/new?assignees=&labels=&template=feature_request.md&title=)! We really appreciate all feedback.

## Reporting Bugs

If you have found a bug, inconsistent or confusing behavior please fill up a [new bug report](https://github.com/scramjetorg/framework-js/issues/new?assignees=&labels=&template=bug_report.md&title=).

## Contributing

You can contribute to this project by giving us feedback ([reporting bugs](#reporting-bugs) and [requesting features](#reporting-features)) and also by writing code yourself! We have some introductory issues labeled with `good first issue` which should be a perfect starter.

The easiest way is to [create a fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) of this repository and then [create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) with all your changes. In most cases, you should branch from and target `main` branch.


