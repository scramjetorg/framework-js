"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const utils_1 = require("../lib/utils");
(0, ava_1.default)("isAsyncFunction correctly detects sync function (function declaration)", t => {
    function sync() {
        return 1;
    }
    t.false((0, utils_1.isAsyncFunction)(sync));
});
(0, ava_1.default)("isAsyncFunction correctly detects sync function (const lambda)", t => {
    const sync = () => {
        return 1;
    };
    t.false((0, utils_1.isAsyncFunction)(sync));
});
(0, ava_1.default)("isAsyncFunction correctly detects async function (function declaration)", t => {
    async function async() {
        return Promise.resolve(1);
    }
    t.true((0, utils_1.isAsyncFunction)(async));
});
(0, ava_1.default)("isAsyncFunction correctly detects async function (const lambda)", t => {
    const async = async () => {
        return Promise.resolve(1);
    };
    t.true((0, utils_1.isAsyncFunction)(async));
});
(0, ava_1.default)("isAsyncFunction correctly detects async function (TransformFunction)", t => {
    const apt = async ({ a }) => {
        return { a, n: a % 2, x: 1 };
    };
    t.true((0, utils_1.isAsyncFunction)(apt));
});
