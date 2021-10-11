import test from "ava";
import { isAsyncFunction } from "../lib/utils";
import { TransformFunction } from "../../ifca/lib/index";

test("isAsyncFunction correctly detects sync function (function declaration)", t => {
    function sync() {
        return 1;
    }

    t.false(isAsyncFunction(sync));
});

test("isAsyncFunction correctly detects sync function (const lambda)", t => {
    const sync = () => {
        return 1;
    };

    t.false(isAsyncFunction(sync));
});

test("isAsyncFunction correctly detects async function (function declaration)", t => {
    async function async() {
        return Promise.resolve(1);
    }

    t.true(isAsyncFunction(async));
});

test("isAsyncFunction correctly detects async function (const lambda)", t => {
    const async = async () => {
        return Promise.resolve(1);
    };

    t.true(isAsyncFunction(async));
});

test("isAsyncFunction correctly detects async function (TransformFunction)", t => {
    const apt: TransformFunction<{a: number}, {[k: string]: number}> = async ({ a }: { a: number }) => {
        return { a, n: a % 2, x: 1 };
    };

    t.true(isAsyncFunction(apt));
});

// This cannot really be done without calling the function to check it's result.
// We don't need this ATM but will be good to keep in mind, such function is a valid JS function too.
test.skip("isAsyncFunction correctly detects sync function returning promise", t => {
    function syncPromise() {
        return Promise.resolve(1);
    }

    t.true(isAsyncFunction(syncPromise));
});
