# DataStream.filter(func)

Filters the stream, keeping only chunks for which `func` returns true.

Parameters:
- func: function accepting a single argument of type `T` (matching DataStream
  type) and returning boolean.

Returns new DataStream instance with the same type `T`.
