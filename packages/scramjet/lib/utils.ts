export function isIterable(iterable: any): Boolean {
    return iterable && iterable[Symbol.iterator] && typeof iterable[Symbol.iterator] === "function";
}

export function isAsyncIterable(iterable: any): Boolean {
    return iterable && iterable[Symbol.asyncIterator] && typeof iterable[Symbol.asyncIterator] === "function";
}

export function isAsyncFunction(func: any): Boolean {
    return func && func[Symbol.toStringTag] === "AsyncFunction";
}
