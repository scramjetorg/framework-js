# DataStream.each

Run `func` on each chunk in the stream and return original chunks. This is
useful when you want to run a function for its side-effects, not the return
value.

**Parameters:**
- func: function accepting a single argument of type `T` (matching DataStream
  type) and optional additional arguments of type `W`.
- args: additional optional arguments of type `W` which will be passed to `func` call.

**Returns** the same DataStream instance.

## Generic signature

```
DataStream<T>.each<U,W>(func: (T, ...W) => Promise<U>, ...args: W[]): DataStream<T>
```

### Language specific notes

1. In Typesript `func` should return `Promise<U> | U` since we need synchronous execution for synchronous values.
1. In Python and C++, promises/futures could be resolved synchronously so `Promise<U>` is enough.

## Examples

### Typescript

```ts
declare class DataStream<T> {
    each<U>(func: Callback<T,U>): DataStream<T>;
}
declare type Callback<X, Y> = (chunk: X) => Promise<Y>;

DataStream.from<Number>([ 1, 2, 3, 4 ])
  .each<void>(chunk => {console.log("got", chunk)})  // result: 1, 2, 3, 4 in returned stream,
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

```c++
template <typename T>
class DataStream {
    public:

    template <typename U>
    DataStream<T>* each(std::function<U(T)>);
};

int main() {
    int x[] = { 1, 2, 3, 4 };

    auto z = DataStream<int>::from(x);

    z->each<void>([](int chunk) { cout << "got " << chunk; });
    // prints "got 1", "got 2", "got 3", "got 4" in console

    return 0;
}
```
