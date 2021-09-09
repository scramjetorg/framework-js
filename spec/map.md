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

```js
// TypeScript
DataStream.from<Number>([ 1, 2, 3, 4 ])
  .map(chunk => chunk * 2)  // result: 2, 4, 6, 8
```
