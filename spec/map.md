# DataStream.map

Transforms each chunk in the stream using `func`.

**Parameters:**
- func: function returning value of type `U` accepting a single argument of type `T` (matching DataStream
  type) and optional additional arguments of type `W`.
- args: additional optional arguments of type `W` which will be passed to `func` call.

**Returns** new DataStream instance with type `U`.

## Generic signature

```
DataStream<T>.map<U,W>(func: (T, ...W) => Promise<U>, ...args: W[]): DataStream<U>
```

### Language specific notes

1. In Typesript `func` should return `Promise<U> | U` since we need synchronous execution for synchronous values.
1. In Python and C++, promises/futures could be resolved synchronously so `Promise<U>` is enough.

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

```c++
template <typename T>
class DataStream {
    public:

    template <typename U>
    DataStream<U>* map(std::function<U(T)>);
};

int main() {
    int x[] = { 1, 2, 3, 4 };

    auto z = DataStream<int>::from(x);

    z->map<int>([](int chunk) { return chunk * 2; }); // result: 2, 4, 6, 8

    return 0;
}
```
