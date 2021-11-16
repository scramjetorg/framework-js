import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";
import { defer } from "../../../_helpers/utils";

test("DataStream can be written to", async (t) => {
    const ds = new DataStream<string>({ maxParallel: 2 });

    ds.write("foo");
    ds.write("bar");

    ds.end();

    t.deepEqual(await ds.toArray(), ["foo", "bar"]);
});

test("DataStream can be written to above maxParallel", async (t) => {
    const ds = new DataStream<string>({ maxParallel: 2 });

    ds.write("foo");
    ds.write("bar");
    ds.write("baz");
    ds.write("bax");

    ds.end();

    t.deepEqual(await ds.toArray(), ["foo", "bar", "baz", "bax"]);
});

test("Writing to DataStream below/above maxParallel returns true/false", async (t) => {
    const ds = new DataStream<string>({ maxParallel: 2 });
    const writes = [
        ds.write("foo"),
        ds.write("bar"),
        ds.write("baz"),
        ds.write("bax")
    ];

    t.deepEqual(writes, [true, false, false, false]);
});

// TBD Add async version (how exactly it should behave?).
test("Writing to DataStream created with 'from' works correctly (sync)", async (t) => {
    const ds = DataStream.from(["ffoo", "fbar"], { maxParallel: 2 });

    ds.write("foo");
    ds.write("bar");
    ds.write("baz");
    ds.write("bax");

    t.deepEqual(await ds.toArray(), ["foo", "bar", "baz", "bax", "ffoo", "fbar"]);
});

test("Writing to ended stream throws an error", async (t) => {
    const ds = new DataStream<string>({ maxParallel: 2 });

    ds.end();

    let thrown: any;

    try {
        ds.write("foo");
    } catch (err) {
        thrown = err;
    } finally {
        t.deepEqual(thrown.message, "Write after end");
    }
});

test("DataStream can be read from ('from' creation)", async (t) => {
    const ds = DataStream.from(["foo", "bar"]);

    ds.resume();

    // Defer since values are available asynchronously in the next tick.
    await defer(0);

    t.deepEqual(ds.read(), "foo");
    t.deepEqual(ds.read(), "bar");
});

test("DataStream can be read from (constructor creation + write)", async (t) => {
    const ds = new DataStream<string>({ maxParallel: 2 });

    ds.write("foo");
    ds.write("bar");
    ds.write("baz");

    ds.resume();

    // Defer since values are available asynchronously in the next tick.
    await defer(0);

    t.deepEqual(ds.read(), "foo");
    t.deepEqual(ds.read(), "bar");
    t.deepEqual(ds.read(), "baz");
});

test("Reading from empty DataStream returns null", async (t) => {
    const ds = new DataStream<string>();

    ds.resume();

    // Defer since values are available asynchronously in the next tick.
    await defer(0);

    t.deepEqual(ds.read(), null);
    t.deepEqual(ds.read(), null);
});

test("After ending DataStream chunks wirtten earlier can be still read", async (t) => {
    const ds = new DataStream<string>();

    ds.write("foo");
    ds.write("bar");
    ds.write("baz");

    ds.resume();
    ds.end();

    // Defer since values are available asynchronously in the next tick.
    await defer(0);

    t.deepEqual(ds.read(), "foo");
    t.deepEqual(ds.read(), "bar");
    t.deepEqual(ds.read(), "baz");
    t.deepEqual(ds.read(), null);
    t.deepEqual(ds.read(), null);
});

test("After pausing DataStream no chunks should be processed/available", async (t) => {
    const ds = new DataStream<string>();

    ds.write("foo");
    ds.write("bar");

    ds.resume();

    // Defer since values are available asynchronously in the next tick.
    await defer(0);

    t.deepEqual(ds.read(), "foo");
    t.deepEqual(ds.read(), "bar");

    ds.pause();

    // Defer since pausing happens asynchronously due to asynchronous IFCA nature.
    await defer(0);

    ds.write("baz");
    ds.write("bax");

    t.deepEqual(ds.read(), null);
    t.deepEqual(ds.read(), null);
});
