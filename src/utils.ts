import { ResolvablePromiseObject, TransformHandler } from "./types";

const SCRAMJET_LOG = process.env.SCRAMJET_LOG;

/**
 * Helper function that prints out debug messages
 *
 * @param {String} msg Debug message to be printed out
 * @param {*} [array] Optional array of objects
 */
function trace(msg:any, ...array: any[]) {
    // TODO: make this into a const false on compile
    if (!SCRAMJET_LOG) return;

    const date = new Date();

    console.log(`${date.valueOf()}: ${msg}`, ...array);
}

function createResolvablePromiseObject<T>(): ResolvablePromiseObject<T> {
    let resolver: any;

    const promise = new Promise<T>(res => {
        resolver = res;
    });

    return { promise, resolver: resolver as () => (T) };
}

function isIterable(iterable: any): boolean {
    return iterable && iterable[Symbol.iterator] && typeof iterable[Symbol.iterator] === "function";
}

function isAsyncIterable(iterable: any): boolean {
    return iterable && iterable[Symbol.asyncIterator] && typeof iterable[Symbol.asyncIterator] === "function";
}

function isAsyncFunction(func: any): boolean {
    return func && func[Symbol.toStringTag] === "AsyncFunction";
}

function isAsyncTransformHandler(func: TransformHandler<any, any>): boolean {
    return isAsyncFunction(func[0]) || isAsyncFunction(func[1]);
}

export {
    trace,
    createResolvablePromiseObject,
    isIterable,
    isAsyncIterable,
    isAsyncFunction,
    isAsyncTransformHandler
};
