"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getId = exports.isAsyncTransformHandler = exports.isAsyncFunction = exports.createResolvablePromiseObject = exports.trace = void 0;
const SCRAMJET_LOG = process.env.SCRAMJET_LOG;
function trace(msg, ...array) {
    if (!SCRAMJET_LOG)
        return;
    const date = new Date();
    console.log(`${date.valueOf()}: ${msg}`, ...array);
}
exports.trace = trace;
function createResolvablePromiseObject() {
    let resolver;
    const promise = new Promise(res => {
        resolver = res;
    });
    return { promise, resolver: resolver };
}
exports.createResolvablePromiseObject = createResolvablePromiseObject;
function isAsyncFunction(func) {
    return func && func[Symbol.toStringTag] === "AsyncFunction";
}
exports.isAsyncFunction = isAsyncFunction;
function isAsyncTransformHandler(func) {
    return isAsyncFunction(func[0]) || isAsyncFunction(func[1]);
}
exports.isAsyncTransformHandler = isAsyncTransformHandler;
function getId(prefix) {
    return `${prefix}-${Date.now()}${(Math.random() * 100).toPrecision(2)}`;
}
exports.getId = getId;
//# sourceMappingURL=utils.js.map