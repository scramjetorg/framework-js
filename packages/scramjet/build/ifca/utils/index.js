"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trace = exports.defer = void 0;
const SCRAMJET_LOG = process.env.SCRAMJET_LOG;
function defer(ts, out) {
    return new Promise((res) => setTimeout(() => res(out), ts));
}
exports.defer = defer;
function trace(msg, ...array) {
    if (!SCRAMJET_LOG)
        return;
    const date = new Date();
    console.log(`${date.valueOf()}: ${msg}`, ...array);
}
exports.trace = trace;
