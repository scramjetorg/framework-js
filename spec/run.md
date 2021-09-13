# DataStream.run()

Consumes all chunks from the stream doing nothing.

**Parameters:** none.

This is useful when what you want is the side-effects of the transformations
(e.g. when for each chunk a request is sent to a server) and not the stream
contents themselves. This uncorks the stream which would otherwise block when
internal buffer gets full.

**Returns** a promise that resolves when the stream ends.

## Generic signature

```
DataStream<T>.run(): Promise<void>
```

## Examples

### Typescript

```js
declare class DataStream<T> {
    run(): Promise<void>;
}
declare type Callback<X, Y> = (initial: Y, chunk: X) => Promise<Y>;

DataStream.from<String>([ "foo", "bar" ])
  .each(x => saveToTheDatabase(x))
  .run()
```

### Python

```python
DataStream.from_from(["foo", "bar"])
  .each(lambda x: saveToTheDatabase(x))
  .run()
```
### C++

```c++
template <typename T>
class DataStream {
    public:

    future<void> run();
};

int main() {
    int x[] = { 1, 2, 3, 4 };

    auto z = DataStream<int>::from(x)
        ->each<void>([](int chunk) { saveToTheDatabase(chunk); })
        ->run();

    return 0;
}
```
