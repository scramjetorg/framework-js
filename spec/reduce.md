# DataStream.reduce

Combines all stream chunks into a single value.

**Parameters:**
- func: function accepting two arguments:
  - `accumulator` of type `U`
  - `current` of type `T` (`T` must match DataStream type). Returns value of
     type `U`.
  - `args` additional arguments which were passed to initial `reduce()` call.
- (optional) initial: value of type `U` used as the first argument of first
  `func` call.  If omitted, first `func` call will use first two chunks as
  arguments.
- args: additional optional arguments of type `W` which will be passed to each `func` call.

Note that `func` will be called sequentially on stream chunks - processing next chunk
will start only after the result of processing the previous one will be available.

**Returns** a promise that resolves to the return value of the last `func` call
(with type `U`).

## Generic signature

```
DataStream<T>.reduce<U,W>(func: (U, T, ...W) => Promise<U>, [initial: U], ...args: W[]): U
```

### Language specific notes

1. In Typesript `func` should return `Promise<U> | U` since we need synchronous execution for synchronous values.
1. In Python and C++, promises/futures could be resolved synchronously so `Promise<U>` is enough.

## Examples

### Typescript

```js
declare class DataStream<T> {
    reduce<U>(func: Callback<T, U>, initial: U): U;
}
declare type Callback<X, Y> = (initial: Y, chunk: X) => Promise<Y>;
```

```js
DataStream.from<Number>([ 1, 2, 3, 4 ])
  .reduce<Number>((a: Number, b: Number) => a + b, 0)  // result: 10
```

```js
DataStream.from<Number>([ 1, 2, 3, 4 ])
  .reduce<String>((s: String, n: Number) => s + String(n), "")  // result: "1234"
```

### Python

```python
DataStream.from_from([1, 2, 3, 4])
  .reduce(lambda a, b => a + b, 0)  # result: 10
```

```python
DataStream.from_from([1, 2, 3, 4])
  .reduce(lambda s, n: s + str(n), "")  # result: "1234"
```

### C++

```c++
template <typename T>
class DataStream {
    public:

    template <typename U>
    U reduce(std::function<U(T, U)>, U initial);
};

int main() {
    int x[] = { 1, 2, 3, 4 };

    auto z = DataStream<int>::from(x);

    z->reduce<int>([](int chunk, int prev) { return prev + chunk; }, 0); // result: 10

    return 0;
}
```

---

# Draft

## Generic signature

```
DataStream<T>.reduce<U,V>(func: (U | V, T) => U | V, [initial: U]): V
```

## Examples

### Typescript


```js
DataStream.from<Number>([ 1, 2, 3, 4 ])
  .reduce<Any, Number>((a: String, b: Number) => parseInt( a ) + b, "0")  // result: 10
```
