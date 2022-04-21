import { ResolvablePromiseObject, TransformHandler } from "./types";

const SCRAMJET_LOG = process.env.SCRAMJET_LOG;

/**
 * Helper function that prints out debug messages
 *
 * @param {String} msg Debug message to be printed out
 * @param {*} [array] Optional array of objects
 */
function trace(msg:any, ...array: any[]) {
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

function isAsyncFunction(func: any): boolean {
    return func && func[Symbol.toStringTag] === "AsyncFunction";
}

function isAsyncTransformHandler(func: TransformHandler<any, any>): boolean {
    return isAsyncFunction(func[0]) || isAsyncFunction(func[1]);
}

function getId(prefix: string): string {
    return `${ prefix }-${ Date.now() }${ (Math.random() * 100).toPrecision(2) }`;
}

export {
    trace,
    createResolvablePromiseObject,
    isAsyncFunction,
    isAsyncTransformHandler,
    getId
};
