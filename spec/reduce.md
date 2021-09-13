# DataStream.reduce(func, initial)

Combines all stream chunks into a single value.

**Parameters:**
- func: function accepting two arguments:
  - `accumulator` of type `U`
  - `current` of type `T` (`T` must match DataStream type). Returns value of
     type `U`.
- (optional) initial: value of type `U` used as the first argument of first
  `func` call.  If omitted, first `func` call will use first two chunks as
  arguments.

Note that `func` will be called sequentially on stream chunks - processing next chunk
will start only after the result of processing the previous one will be available.

**Returns** a promise that resolves to the return value of the last `func` call
(with type `U`).

## Generic signature

```
DataStream<T>.reduce<U>(func: (U, T) => U, [initial: U]): U
```

## Examples

### Typescript

```js
// TypeScript
DataStream.from<Number>([ 1, 2, 3, 4 ])
  .reduce<Number>((a: Number, b: Number) => a + b)  // result: 10
```

```js
// TypeScript
DataStream.from<Number>([ 1, 2, 3, 4 ])
  .reduce<String>((s: String, n: Number) => s + String(n), "")  // result: "1234"
```

### Python

### C++
