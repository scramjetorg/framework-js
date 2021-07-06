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
