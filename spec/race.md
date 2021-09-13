# DataStream\<T>.race\<U>( functions )

Processes all provided functions in parallel and returns the first resolved, for each stream chunk.

This method is to allow running multiple asynchronous operations for each chunk awaiting just the result of the quickest to execute, just like Promise.race behaves.

Keep in mind that if one of provided functions is rejected, `race` will only raise an error if that was the first function to be rejected.

Parameters:

- functions: Array of asynchronus functions to be executed in parallel. Each function will receive current chunk as a first argument when called. The resulting value of the fastest function becomes a new chunk.

Returns new `DataStream` instance with the type `U`.

**Generic signature**:

```
DataStream<T>.race<U>( futures: Function[] ): DataStream<U>;
future( chunk: T ): Promise<U>
```

## Examples

### Typescript

```js
declare class DataStream<T> {
    race<U>(funcs: Callback<T, U>[]): DataStream<U>;
}
declare type Callback<X, Y> = (chunk: X) => Promise<Y>;

// Fetch football matches results for each match from the provider which retruns results the fastest.
const urls = [ 'https://scores.com/result/_match_', 'https://goals.com/results/_match_', , 'https://football.com/results/_match_' ];

const resultsStream = DataStream<String>.from( [ 'pl-en', 'en-us', 'cz-sk' ] );

const fetchFunctions = urls.map( url => {
    return ( chunk ) => {
        return fetch( url.replace( '_match_', chunk ) ); // fetch is async
    };
} );

resultsStream.race( fetchFunctions ); // The result should be something like [ '1:0', '2:2', '3:1' ]
```

### Python

```python
# Fetch football matches results for each match from the provider which retruns results the fastest.
import asyncio

const urls = ['https://scores.com/result/_match_', 'https://goals.com/results/_match_', 'https://football.com/results/_match_']

const results = DataStream.from_from(['pl-en', 'en-us', 'cz-sk'])

const fetchFunctions = map(
    lambda url: (lambda chunk: fetch( url.replace( '_match_', chunk ))),
    urls
)

results.race(fetchFunctions);  # The result should be something like [ '1:0', '2:2', '3:1' ]
```

### C++

---

## Remarks:

1. From what I understand it works like a `map` but instead of one mapping function it has many and result of only fastes one (for each chunk separately) becomes de facto mapper function.
1. The `functions` param could be described also as `promises`/`futures` to be more generic across languages maybe?
1. I'm not sure about `future( chunk: T ): Promise<T>` but looking at current implementation (`chunkPromise.then(func)`), `chunk` is provided to `func` via promise chain. Not sure if it's intended since it's not really documented, but makes sense.
