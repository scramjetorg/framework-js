# DataStream.each(func)

Run `func` on each chunk in the stream and return original chunks. This is
useful when you want to run a function for its side-effects, not the return
value.

**Parameters:**
- func: function accepting a single argument of type `T` (matching DataStream
  type).

**Returns** the same DataStream instance.

## Generic signature

```
DataStream<T>.each<U>(func: T => U): DataStream<T>
```

## Examples

### Typescript

```js
declare class DataStream<T> {
    each<U>(func: Function<T> => U): DataStream<T>;
}

DataStream.from<Number>([ 1, 2, 3, 4 ])
  .each(chunk => {console.log("got", chunk)})  // result: 1, 2, 3, 4 in returned stream,
                                               // "got 1", "got 2", "got 3", "got 4" in console
```

### Python

```python
DataStream.from_from([1, 2, 3, 4])
  .each(lambda chunk: print("got", chunk))
  # result: 1, 2, 3, 4 in returned stream,
  # "got 1", "got 2", "got 3", "got 4" in console
```

### C++
