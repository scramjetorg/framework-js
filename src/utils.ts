const SCRAMJET_LOG = process.env.SCRAMJET_LOG;

type ResolvablePromiseObject<T> = {promise: Promise<T>, resolver: () => (T)};

/**
 * Helper function that defers and optionaly returns given output after waiting.
 *
 * @param {number} ts Number of milliseconds to wait
 * @param {Object} [out] Optional output
 * @returns {Promise} Promise resolved after given timoeut
 */
function defer<X extends any | undefined>(ts: number, out?: X): Promise<X | void> {
    return new Promise((res) => setTimeout(() => res(out), ts));
}

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

function isIterable(iterable: any): Boolean {
    return iterable && iterable[Symbol.iterator] && typeof iterable[Symbol.iterator] === "function";
}

function isAsyncIterable(iterable: any): Boolean {
    return iterable && iterable[Symbol.asyncIterator] && typeof iterable[Symbol.asyncIterator] === "function";
}

function isAsyncFunction(func: any): Boolean {
    return func && func[Symbol.toStringTag] === "AsyncFunction";
}

export {
    defer,
    trace,
    createResolvablePromiseObject,
    ResolvablePromiseObject,
    isIterable,
    isAsyncIterable,
    isAsyncFunction
};
