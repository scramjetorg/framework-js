# IFCA

## Possible states

* R - items to read
* W - items to write
* M - max parallel

| Case                  | Condition    | Read                                                       |
| --------------------- | ------------ | ---------------------------------------------------------- |
| 1. `0` done, `0` proc |              | await until wrote enough                                   |
| 2. `0` done, `x` proc | `x < R`      | use "3"                                                    |
| 3. `x` done, `y` proc | `x + y <R`   | return done, asyncgen processed and await until wrote rest |
| 4. `x` done, `y` proc | `x + y >= R` | return done and asyncgen processed                         |
| 5. `x` done, `0` proc | `x >= R`     | return done and await until wrote                          |

| Case                  | Condition       | Write                                 |
| --------------------- | --------------- | ------------------------------------- |
| 1. `0` done, `0` proc | `W <= M`        | write all to proc                     |
| 2. `0` done, `x` proc | `x + W <= M`    | write all to proc                     |
| 1. `0` done, `0` proc | `W > M`         | write all to proc, await `proc[-M]`   |
| 3. `x` done, `y` proc | `y + W > M`     | write all to proc, await `proc[-y-M]` |
| 4. `x` done, `y` proc | `x + y + W > W` | write all to, await `read[]`          |
| 5. `x` done, `0` proc | `x >= R`        |                                       |

[I,I,I,I,I,I,I,I] -> on write await proc[-6].read, on read proc.shift().value;
[D,D,D,D,D,D,D,D] -> on write await proc[-6].read