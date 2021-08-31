# IFCA

## Possible states

-   R - items to read
-   W - items to write
-   M - max parallel

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

## Debug

In order to debug ava test in VS Code, add following configuration to `launch.json`:

```
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations":[
      {
         "type":"pwa-node",
         "request":"launch",
         "name":"Launch Program",
         "skipFiles":[
            "<node_internals>/**"
         ],
         "program":"${workspaceFolder}/test/test.spec.ts",
         "outFiles":[
            "${workspaceFolder}/**/*.js"
         ]
      },
      {
         "type":"node",
         "request":"launch",
         "name":"Debug AVA test file",
         "runtimeExecutable":"${workspaceFolder}/node_modules/ava/cli.js",
         "runtimeArgs":[
            "${file}"
         ],
         "outputCapture":"std",
         "skipFiles":[
            "<node_internals>/**/*.js"
         ]
      }
   ]
}
```

Note that `runtimeExecutable` in the example above has been changed to: `node_modules/ava/cli.js`. More details in the follwing link:

https://github.com/avajs/ava/blob/main/docs/recipes/debugging-with-vscode.md

## Test Case Scenarios

### Simple Order Check

#### Preconditions

In this scenario we want to prove that for `MAX_PARALLEL`: `4` and `6` elements, the final result will be:

```
{ a: 0, n: 0, x: 0, y: 0, z: 0 }
{ a: 1, n: 1, x: 1, y: 3, z: 3 }
{ a: 2, n: 0, x: 2, y: 1, z: 1 }
{ a: 3, n: 1, x: 3, y: 4, z: 4 }
{ a: 4, n: 0, x: 4, y: 2, z: 2 }
{ a: 5, n: 1, x: 5, y: 5, z: 5 }
```

#### Execution

When first element `{ a: 0 }` is written, it resolves immediately. This is checked in the test.

Next, `{ a: 1 }` is written and it's processing is defered (processing of all odd numbers is defered due to `asyncPromiseTransform`). Write is resolved immediately (test does check this assertion and checks all other writes).
Afterwards, `{ a: 2 }` arrives and it's processed immediately. Thus, `y` = `1`.
Next element is `{ a: 3 }` and again it waits.
Finally, `{ a: 4 }` is written and processed. Thus, `y` = `2`. Right now, we reached `MAX_PARALLEL` as there are 4 items being processed.

Last write, `{ a: 5 }` results in Promise being returned instead of resolved immediately. This item will wait until the other items are processed. As as result `y` will be equal to `5`.

Right now, all even numbers (`{ a: 0, y: 0 }`, `{ a: 2, y: 1 }` and `{ a: 4, y: 2}`) were processed correctly and `{ a: 1 }` and `{ a: 3 }` can resume. This causes `y` to be `3` and `4` respectively.

In the end and as already mentioned `{ a: 5 }` is processed last and `y` becomes `5`.

This end the test execution.
