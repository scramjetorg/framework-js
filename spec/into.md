# DataStream\<T>.into\<U>( func, into )

Allows own implementation of stream chaining or writing/copying stream chunks into custom object or structure.

This method provides a way to copy stream chunks into another stream or any other structure. The asynchronous `callbackFn` is called on every chunk and should implement writes in it's own way. The resolution will be awaited for flow control.

Parameters:

- callbackFn: function that is called on every stream chunk. If the callback is asynchronous it should return a promise.
    - into: `into` object passed as a second argument to the initial `.into()` call.
    - chunk: current `chunk`.
- into: stream or any object which will be passed to `callbackFn` on every call.

Returns `into` passed as the second argument to the initial `.into()` call. If it's a stream, this method can be chained.

**Generic signature**:

```
DataStream<T>.into<U>( callbackFn: Function, into: U ): U;
callbackFn( into: U, chunk: T ): Promise<void> | void
```

**Examples**:

The `.into()` method may be used to write chunks from `this` stream to any other stream:

```js
// TypeScript
const numberStream = DataStream.from<Number>( [ 1, 2, 3, 4 ] );
const stringStream = new DataStream<String>();

numberStream.into( ( into, chunk ) => { into.write( `${ chunk }` ) }, stringStream ); // stringStream now contains [ '1', '2', '3', '4' ]
```

Or to copy `this` stream chunks into another object or structure (e.g. array):

```js
// TypeScript
const stringStream = DataStream.from<String>( [ 'foo', 'bar', 'baz' ] );

const textParts = dataStream.into<String[]>( ( into, chunk ) => { into.push( chunk ) }, [] );

console.log( textParts ); // [ 'foo', 'bar', 'baz' ]
```

---

## Remarks

1. Since the `callbackFn` is custom (provided by developer) it can be used to write chunks from Scramjet stream to any other "incompatible" stream, for example Highland.js (using `Stream.write( chunk )`).
2. Curretn implementation (see `scramjet-core`) assumes `into` must be a subtype of `DataStream` but it seems reasonable to accept basically anything.
