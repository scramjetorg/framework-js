# DataStream.filter(func)

Filters the stream, keeping only chunks for which `func` returns true.

**Parameters:**
- func: function accepting a single argument of type `T` (matching DataStream
  type) and returning boolean.

**Returns** new DataStream instance with the same type `T`.

## Generic signature

```
DataStream<T>.filter(func: T => Boolean): DataStream<T>
```

## Examples

```js
// TypeScript
const numbers = DataStream.from<Number>([ 1, 2, 3, 4, 5, 6 ]);
const odd = numbers.filter(chunk => chunk % 2)  // result: 1, 3, 5
```