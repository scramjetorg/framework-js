# DataStream#from\<T>( input, options )

Creates new data stream of a specified typed based on the given input.

Depending on the input type `.from()` will consume all the data (each separate piece of data is called a `chunk`) and end the stream or consume new chunks as they come and end only when `null` value chunk is received.

This methods, as input, accepts iterables (both synchronus and asynchronous) or streams.

Parameters:

- input: Input data from which new stream will be created. It should be `Iterable` or `Stream` of type `T`.
- options: Options object providing values for predefined configuration options.

Returns `DataStream` of type `T`.

**Generic signature**:

```
DataStream.from<T>( Iterable<T> input, options?: Object ): DataStream<T>
DataStream.from<T>( Stream<T> input, options?: Object ): DataStream<T>
```

**Examples**:

```ts
const stringStream = DataStream.from<String>( input ); // input is of type Iterable<String>
const stringStreamCopy = DataStream.from<String>( stringStream );
const numberStream = DataStream.from<Number>( stringStream.map( parseInt ) )
```

---

## Remarks

1. If we would like to have more fancy methods, we could go with `fromModule()`, `fromFile()`, `fromUrl()` variations in JS and in languages which supports methods overloading just overload `from()`. So instead of "bulking" `from()`, make is simpler but provide other "convienience creators". Apart from that:
    * Also giving up intermediate types, like functions, async functions, promises which need to retrun iterable/streams makes API simpler (kind of simplicity vs user convenience as it saves some keystrokes).
    * Maybe we could also support `EventEmitters` (Streams/Readables also implements EE)?
    * And stream-like, iterable-like objects could be theoretically supported (in JS at least) via checking for requried methods/symbols.
1. I'm not really sure if `Readable` is `Iterable` too in JS, [theoretically yes (via `AsyncIterator`)](https://nodejs.org/api/stream.html#stream_readable_symbol_asynciterator) but mentioning `Streams` along `Iterables` seems to be more clear (and it may differ how it works in different languages too).
