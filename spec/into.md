# DataStream.into

Allows own implementation of stream chaining or writing/copying stream chunks into custom object or structure.

This method provides a way to copy stream chunks into another stream or any other structure. The asynchronous `callbackFn` is called on every chunk and should implement writes in it's own way. The resolution will be awaited for flow control.

Parameters:

- func: function that is called on every stream chunk. If the callback is asynchronous it should return a promise.
    - into: `into` object passed as a second argument to the initial `.into()` call.
    - chunk: current `chunk`.
    - args: optional argumetns which were passed to initial `into()` call.
- into: stream or any object which will be passed to `func` on every call.
- args: additional optional arguments of type `U` which will be passed to `func` call.

Returns `into` passed as the second argument to the initial `.into()` call. If it's a stream, this method can be chained.

## Generic signature

```
DataStream<T>.into<U,W>(func: Function, into: U, ...args: W[]): U;
callbackFn(into: U, chunk: T, ...args: W[]): Promise<void>
```
### Language specific notes

1. In Typesript `func` should return `Promise<void> | void` since we need synchronous execution for synchronous values.
1. In Python and C++, promises/futures could be resolved synchronously so `Promise<void>` is enough.

## Examples

### Typescript

```js
declare class DataStream<T> {
    into<U>(func: Callback<T, U>): U;
}
declare type Callback<X, Y> = (into: Y, chunk: X) => Promise<void>;
```

The `.into()` method may be used to write chunks from `this` stream to any other stream:

```js
const numberStream = DataStream.from<Number>( [ 1, 2, 3, 4 ] );
const stringStream = new DataStream<String>();

numberStream.into( ( into, chunk ) => { into.write( `${ chunk }` ) }, stringStream ); // stringStream now contains [ '1', '2', '3', '4' ]
```

Or to copy `this` stream chunks into another object or structure (e.g. array):

```js
const stringStream = DataStream.from<String>( [ 'foo', 'bar', 'baz' ] );

const textParts = stringStream.into<String[]>( ( into, chunk ) => { into.push( chunk ) }, [] );

console.log( textParts ); // [ 'foo', 'bar', 'baz' ]
```

### Python

The `.into()` method may be used to write chunks from `this` stream to any other stream:

```python
numberStream = DataStream.from_from([1, 2, 3, 4])
const stringStream = new DataStream()

numberStream.into(lambda dest, chunk: dest.write(f'{chunk}'), stringStream)
# stringStream now contains [ '1', '2', '3', '4' ]
```

Or to copy `this` stream chunks into another object or structure (e.g. array):

```python
stringStream = DataStream.from_from(['foo', 'bar', 'baz'])

textParts = stringStream.into(lambda dest, chunk: dest.append(chunk), [])

print(textParts)  # [ 'foo', 'bar', 'baz' ]
```

### C++

```c++
template <typename T>
class DataStream {
    public:

    template <typename U>
    U into(std::function<void(T, U)>, U into);
};

int main() {
    int x[] = { 1, 2, 3, 4 };

    auto z = DataStream<int>::from(x);
    auto s = new DataStream<string>();

    z->into<DataStream<string>>([](int chunk, DataStream<string> into) { return into.wrtie( std::to_string(chunk) ); }, s );

    return 0;
}
```

---

## Remarks

1. Since the `callbackFn` is custom (provided by developer) it can be used to write chunks from Scramjet stream to any other "incompatible" stream, for example Highland.js (using `Stream.write( chunk )`).
2. Curretn implementation (see `scramjet-core`) assumes `into` must be a subtype of `DataStream` but it seems reasonable to accept basically anything.
