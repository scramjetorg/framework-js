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
// TypeScript
DataStream.from<Number>([ "foo", "bar" ])
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
