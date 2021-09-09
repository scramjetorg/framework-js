# DataStream.map(func)

Transforms each chunk in the stream using `func`.

Parameters:
- func: function accepting a single argument of type `T` (matching DataStream
  type) and returning value of type `U`.

Returns new DataStream instance with type `U`.
