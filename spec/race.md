# DataStream\<T>.race( functions )

Processes all provided functions in parallel and returns the first resolved, for each stream chunk.

This method is to allow running multiple asynchronous operations for each chunk awaiting just the result of the quickest to execute, just like Promise.race behaves.

Keep in mind that if one of provided functions is rejected, `race` will only raise an error if that was the first function to be rejected.

Parameters:

- functions: Array of asynchronus functions to be executed in parallel. Each function will receive current chunk as a first argument when called. The resulting value of the fastest function becomes a new chunk.

Returns `this` stream.

**Generic signature**:

```
DataStream<T>.race<U>( futures: Function[] ): DataStream<T>;
future( chunk: T ): Promise<T>
```

Examples:

```js
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

---

## Remarks:

1. From what I understand it works like a `map` but instead of one mapping function it has many and result of only fastes one (for each chunk separately) becomes de facto mapper function.
1. The `functions` param could be described also as `promises`/`futures` to be more generic across languages maybe?
1. I'm not sure about `future( chunk: T ): Promise<T>` but looking at current implementation (`chunkPromise.then(func)`), `chunk` is provided to `func` via promise chain. Not sure if it's intended since it's not really documented, but makes sense.
