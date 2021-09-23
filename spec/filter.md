# DataStream.filter

Filters the stream, keeping only chunks for which `func` returns true.

**Parameters:**
- func: function returning boolean value accepting a single argument of type `T` (matching DataStream
  type) and optional additional arguments of type `U`.
- args: additional optional arguments of type `U` which will be passed to `func` call.

**Returns** new DataStream instance with the same type `T`.

## Generic signature

```
DataStream<T>.filter<U>(func: (T, ...U) => Promise<Boolean>, ...args: U[]): DataStream<T>
```

### Language specific notes

1. In Typesript `func` should return `Promise<Boolean> | Boolean` since we need synchronous execution for synchronous values.
1. In Python and C++, promises/futures could be resolved synchronously so `Promise<Boolean>` is enough.

## Examples

### Typescript

```ts
declare class DataStream<T> {
    filter(func: Callback<T>): DataStream<T>;
}
declare type Callback<X> = (chunk: X) => Boolean;

const numbers = DataStream.from<Number>([ 1, 2, 3, 4, 5, 6 ]);
const odd = numbers.filter(chunk => chunk % 2)  // result: 1, 3, 5
```

### Python

```python
numbers = DataStream.from_from([1, 2, 3, 4, 5, 6])
odd = numbers.filter(lambda x: x % 2)  # result: 1, 3, 5
```
### C++

```c++
template <typename T>
class DataStream {
    public:

    DataStream<T>* filter(std::function<bool(T)>);
};

int main() {
    int x[] = { 1, 2, 3, 4, 5, 6 };

    auto z = DataStream<int>::from(x);

    z->filter([](int chunk) { return (bool)(chunk % 2); }); // result: 1, 3, 5

    return 0;
}
```
