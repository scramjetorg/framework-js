# DataStream.reduce(func, initial)

Combines all stream chunks into a single value.

Parameters:
- func: function accepting two arguments: `accumulator` of type `U` and
  `current` of type `T` (`T` must match DataStream type). Returns value of type
  `U`.
- (optional) initial: value of type `U` used as the first argument of first
  `func` call.  If omitted, first `func` call will use first two chunks as
  arguments.

`func` will be called sequentially on stream chunks - processing next chunk
will start only after the result of processing the previous one will be available.

Returns a promise that resolves to the return value of the last `func` call
(with type `U`).
