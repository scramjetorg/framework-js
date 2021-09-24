"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAsyncFunction = exports.isAsyncIterable = exports.isIterable = void 0;
function isIterable(iterable) {
    return iterable && iterable[Symbol.iterator] && typeof iterable[Symbol.iterator] === "function";
}
exports.isIterable = isIterable;
function isAsyncIterable(iterable) {
    return iterable && iterable[Symbol.asyncIterator] && typeof iterable[Symbol.asyncIterator] === "function";
}
exports.isAsyncIterable = isAsyncIterable;
function isAsyncFunction(func) {
    return func && func[Symbol.toStringTag] === "AsyncFunction";
}
exports.isAsyncFunction = isAsyncFunction;
