## How to run test?

In `pts` directory execute `npm run test`

## Benchmarks

In order to measure how fast each code works `console.time()` and `console.timeEnd()` were added to `PTS` test.

Next, in `order.spec.js` following line was swapped `const { PromiseTransformStream } = require("../lib/promise-transform-stream-ifca");` (new IFCA algorithm) with `const { PromiseTransformStream } = require("../lib/promise-transform-stream");` (old code based on mk-transform) and the tests were run 5 times.

Results are shown in the table below:

| Algorithm    | Number of test runs | Min    | Max    | Average |
| ------------ | ------------------- | ------ | ------ | ------- |
| mk-transform | 5                   | 4.203s | 4.220s | 4.212s  |
| IFCA         | 5                   | 4.267s | 4.281s | 4.275s  |

### Detailed results

| Run     | mk-transform | IFCA   |
| ------- | ------------ | ------ |
| 1       | 4.220s       | 4.278s |
| 2       | 4.215s       | 4.267s |
| 3       | 4.205s       | 4.271s |
| 4       | 4.215s       | 4.281s |
| 5       | 4.203s       | 4.279s |
|         |              |        |
| Average | 4.212s       | 4.275s |
