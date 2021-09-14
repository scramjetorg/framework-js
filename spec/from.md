# DataStream#from

Creates new data stream of a specified typed based on the given input.

Depending on the input type `.from()` will consume all the data (each separate piece of data is called a `chunk`) and end the stream or consume new chunks as they come and end only when `null` value chunk is received.

This methods, as input, accepts iterables (both synchronus and asynchronous) or streams.

Parameters:

- input: Input data from which new stream will be created. It should be `Iterable` or `Stream` of type `T`.
- options: Options object providing values for predefined configuration options.

Returns new `DataStream` instance of the type `T`.

## Generic signature

```
DataStream.from<T>(Iterable<T> input, options?: Object): DataStream<T>
DataStream.from<T>(Stream<T> input, options?: Object): DataStream<T>
```

## Examples

### Typescript

```js
declare class DataStream<T> {
    static from<U>(input: Iterable<U> | Readable<U>, options?: Object): DataStream<U>;
}

const stringStream = DataStream.from<String>( input ); // input is of type Iterable<String>
const stringStreamCopy = DataStream.from<String>( stringStream );
const numberStream = DataStream.from<Number>( stringStream.map( parseInt ) )
```

### Python

```python
stringStream = DataStream.from_from(input)
stringStreamCopy = DataStream.from_from(stringStream)
numberStream = DataStream.from_from(stringStream.map(int))
```

### C++

```c++
struct DataStreamOpts {
    int maxParallel = 0;
};

template <typename T>
class DataStream {
    public:

    template <typename U>
    static DataStream<U>* from(U[] input, DataStreamOpts opts = NULL);
};

int main() {
    int x[] = { 1, 2, 3, 4 };
    string s[] = { "foo", "bar", "baz" };

    auto stringStream = DataStream<int>::from(x);
    auto numberStream = DataStream<string>::from(s);

    return 0;
}
```

---

## Remarks

1. Generator needs to be called (so `Iterable` can be passed to `from`). It would be `.from( generatorFn() )` instead of what we have now - `.from( generatorFn )` so it practically the same case as regular function returning `Iterable`.
1. If we would like to have more fancy methods, we could go with `fromModule()`, `fromFile()`, `fromUrl()` variations in JS and in languages which supports methods overloading just overload `from()`. So instead of "bulking" `from()`, make is simpler but provide other "convienience creators". Apart from that:
    * Also giving up intermediate types, like functions, async functions, promises which need to retrun iterable/streams makes API simpler (kind of simplicity vs user convenience as it saves some keystrokes).
    * Maybe we could also support `EventEmitters` (Streams/Readables also implements EE)?
    * And stream-like, iterable-like objects could be theoretically supported (in JS at least) via checking for requried methods/symbols.
1. I'm not really sure if `Readable` is `Iterable` too in JS, [theoretically yes (via `AsyncIterator`)](https://nodejs.org/api/stream.html#stream_readable_symbol_asynciterator) but mentioning `Streams` along `Iterables` seems to be more clear (and it may differ how it works in different languages too).
