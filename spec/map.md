# DataStream.map(func)

Transforms each chunk in the stream using `func`.

**Parameters:**
- func: function accepting a single argument of type `T` (matching DataStream
  type) and returning value of type `U`.

**Returns** new DataStream instance with type `U`.

## Generic signature

```
DataStream<T>.map<U>(func: T => U): DataStream<U>
```

## Examples

### Typescript

```js
declare class DataStream<T> {
    map<U>(func: Callback<T, U>): DataStream<U>;
}
declare type Callback<X, Y> = (chunk: X) => Promise<Y>;

DataStream.from<Number>([ 1, 2, 3, 4 ])
  .map(chunk => chunk * 2)  // result: 2, 4, 6, 8
```

### Python

```python
DataStream.from_from([1, 2, 3, 4])
  .map(lambda chunk: chunk * 2)  # result: 2, 4, 6, 8
```

### C++
