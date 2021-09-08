Creates new data stream of a specified typed based on the given input.

Depending on the input type `.from()` will consume all the data (each separate piece of data is called a `chunk`) and end the stream or consume new chunks as they come and end only when `null` value chunk is received.

This methods, as input, accepts iterables (both synchronus and asynchronous) or anything which returns or resolves to an iterable. If function is passed (both synchronus and asynchronus ones are accepted), its return value will be then treated and used as iterable. If promise is passed, its resolved value will be then treated and used as iterable.

```
.from<Type>( Iterable input ): DataStream<Type>
.from<Type>( Future input => Iterable ): DataStream<Type>
.from<Type>( Callable input => Iterable | Future ): DataStream<Type>
```

---

## Drafts

Input can be of type:
* Iterables of any type (for example [JS iterables](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) - String, Array, TypedArray, Map, Set)
* AsyncIterables
* Generator functions, both sync and async, so the functions which returns a generator (which is a type of iterable)
* Functions, both sync and async
* Promises
* Regular strings
* Readables (which are type of AsyncIterables) or stream.Readable?
    * looks like [it implements AsyncIterator](https://nodejs.org/api/stream.html#stream_readable_symbol_asynciterator) or can be used in more stream-like manner with `read()`, `resume()`, `pipe()`, etc - **should from accept streams too then?**
* EventEmmiters?

any[] | Iterable<any> | Buffer - Iterables
Readble - AsyncIterable
GeneratorFunction | Function | AsyncGeneratorFunction | AsyncFunction | Promise - returns Iterable/AsyncIterable
string - resolving as a module and use as Iterable/AsyncIterable

So input should be Iterable (sync or async), any function or promise returning such iterable

Refs:
* iterables - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators
* asynciterables - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator and https://tc39.es/ecma262/#sec-asynciterator-interface

It is a static method which can produce tpyed stream or regular one base on from what class it was called.

It can also be paramterized.

For example (TS code below):

```ts
DataStream.from<String>( ... ) produces DataStream of type String (DataStream<String>)
```
Or calling it on a specialized stream:

```ts
StringStream.from( ... ) produces StringStream (since it is not generic type)
```


input: any[] | Iterable<any> | AsyncGeneratorFunction | GeneratorFunction | AsyncFunction | Promise<any> | Function | string | Readable, options?: DataStreamOptions | Writable, ...args: any[]): DataStream;

```
    /**
     * Returns a DataStream from pretty much anything sensibly possible. Depending on type: * `self` will return self immediately * `Readable` stream will get piped to the current stream with errors forwarded * `Array` will get iterated and all items will be pushed to the returned stream. The stream will also be ended in such case. * `GeneratorFunction` will get executed to return the iterator which will be used as source for items * `AsyncGeneratorFunction` will also work as above (including generators) in node v10. * `Iterable`s iterator will be used as a source for streams You can also pass a `Function` or `AsyncFunction` that will be executed and it's outcome will be passed again to `from` and piped to the initially returned stream. Any additional arguments will be passed as arguments to the function. If a `String` is passed, scramjet will attempt to resolve it as a module and use the outcome as an argument to `from` as in the Function case described above. For more information see {@link modules.md} A simple example from a generator: ```javascript DataStream .from(function* () { while(x < 100) yield {x: x++}; }) .each(console.log) // {x: 0} // {x: 1} // ... // {x: 99} ```
     * @param input argument to be turned into new stream
     * @param options options for creation of a new stream or the target stream
     * @param ...args additional arguments for the stream - will be passed to the function or generator
     */
```

Generators in JS [are Iterables](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) so mentioning them separately may not make sense

> If a `String` is passed, scramjet will attempt to resolve it as a module and use the outcome as an argument to `from` as in the Function case described above. For more information see {@link modules.md}.

Makes it kind of too complex, maybe we could get rid of this one (or have a dedicated method). Plus keeping it consistent with other langs can be difficult. Such module still needs to expose Iterable (or acceptable type) so it saves few lines of code.
