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
