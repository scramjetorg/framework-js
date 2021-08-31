## How to run test?

In `pts` directory execute `npm run test`

## Benchmarks

In order to measure how fast each code works following commands and methods were considered:

-   `/usr/bin/time` - which measures how long given command is running
-   `console.time()` and `console.timeEnd()` - which starts and ends timer respectively
-   `performance.now()` - which returns the current high resolution millisecond timestamp

> Unlike other timing data available to JavaScript (for example Date.now), the timestamps returned by performance.now() are not limited to one-millisecond resolution. Instead, they represent times as floating-point numbers with up to microsecond precision.

> Also unlike Date.now(), the values returned by performance.now() always increase at a constant rate, independent of the system clock (which might be adjusted manually or skewed by software like NTP).

Source: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now

Therefore, `performance.now()` was added to `PTS` test in order to measure execution time. However, we may note that in our circumstances all three methods may produce same or very similar results.

Next, in `order.spec.js` following line was swapped `const { PromiseTransformStream } = require("../lib/promise-transform-stream-ifca");` (new IFCA algorithm) with `const { PromiseTransformStream } = require("../lib/promise-transform-stream");` (old code based on mk-transform) and the tests were run 5 times.

After inital benchmarking, it was decided to run the test serially and not concurrently. Thus, `test.serial()` method was used. Moreover, before each test starts there is a one second `sleep()` method called in order to allow garbage collection.

Finally, IFCA was compiled with `tsc` compiler (`npm run build`) and JS compiled code was used in third set.

Results are shown in the table below:

| Algorithm     | Number of test runs | Min    | Max    | Average |
| ------------- | ------------------- | ------ | ------ | ------- |
| mk-transform  | 5                   | 4.203s | 4.220s | 4.212s  |
| IFCA          | 5                   | 4.267s | 4.281s | 4.275s  |
| Compiled IFCA | 5                   | 4.180s | 4.219s | 4.190s  |

### Detailed results

| Run     | mk-transform | IFCA   | Compiled IFCA |
| ------- | ------------ | ------ | ------------- |
| 1       | 4.220s       | 4.278s | 4.181s        |
| 2       | 4.215s       | 4.267s | 4.183s        |
| 3       | 4.205s       | 4.271s | 4.186s        |
| 4       | 4.215s       | 4.281s | 4.180s        |
| 5       | 4.203s       | 4.279s | 4.219s        |
|         |              |        |               |
| Average | 4.212s       | 4.275s | 4.190s        |
