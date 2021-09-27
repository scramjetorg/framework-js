/* eslint-disable */

import test from "ava";
import { IFCA } from "../lib/index";

type MaybePromise<X> = Promise<X>|X;

// IFCA can detect on it's own if stream has ended, so the Stream using it will
// be sending end() event based on input. That's why some tests needs calling
// end() explicitly (simulating cases when stream has ended).

test("Identity function, numbers starting from 1", async (t) => {
    const ifca = new IFCA(4, (x: number) => {t.log('Processing', x); return x});

    for (let i = 1; i <= 4; i++) {
        ifca.write(i);
    }

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];

    const results = await Promise.all(read4);

    t.log('Output:', results);

    t.deepEqual(results, [1,2,3,4], "Should pass elements unchanged");
});

test("Identity function, objects starting from 0", async (t) => {
    const ifca = new IFCA(4, (x: {i: number}) => {t.log('Processing', x); return x; });

    for (let i = 0; i < 4; i++) {
        ifca.write({i});
    }

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];
    const results = await Promise.all(read4);
    t.log('Output:', results)

    t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3}], "Should pass elements unchanged");
});

test("Identity function, numbers starting from 0", async (t) => {
    const ifca = new IFCA(4, (x: number) => {t.log('Processing', x); return x; });

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];
    const results = await Promise.all(read4);
    t.log('Output:', results)

    t.deepEqual(results, [0,1,2,3], "Should pass elements unchanged");
});

test("Falsy values in results", async (t) => {
    function makeSomeFalsyValues(x: number): any {
        switch(x % 6) {
            case 0: return null;
            case 1: return 0;
            case 2: return false;
            case 3: return "";
            case 4: return undefined;
            case 5: return NaN;
        }
    }
    const ifca = new IFCA(4, (x: number) => {t.log('Processing:', x); return makeSomeFalsyValues(x)});

    // Use more input elems to make sure processing doesn't stop after 6th one
    for (let i = 0; i < 8; i++) {
        ifca.write(i);
    }

    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read8)
    t.log('Output:', results)
    const expected = [null, 0, false, '', undefined, NaN, null, 0]

    t.deepEqual(results, expected, "Falsy values in output shouldn't be treated specially");
});

test("Identity function, 4x write, 8x read (with explicit end)", async (t) => {
    const ifca = new IFCA(4, (x: {i: number}) => {t.log('Processing', x); return x});

    for (let i = 0; i < 4; i++) {
        ifca.write({i});
    }
    await ifca.end();

    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read8);
    t.log('Output:', results)

    t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3},null,null,null,null], "Should first output chunks matching inputs, then nulls");
});

// // Should it work without explicit '.end()' call?
// // test("Identity function, 4x write, 8x read (without explicit end)", async (t) => {
// //     const ifca = new IFCA(4, (x: {i: number}) => {t.log('Processing', x); return x});

// //     for (let i = 0; i < 4; i++) {
// //         ifca.write({i});
// //     }

// //     const read8 = [
// //         ifca.read(), ifca.read(), ifca.read(), ifca.read(),
// //         ifca.read(), ifca.read(), ifca.read(), ifca.read()
// //     ];
// //     const results = await Promise.all(read8);
// //     t.log('Output:', results)

// //     t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3},null,null,null,null], "Should first output chunks matching inputs, then nulls");
// // });

test("Identity function, 8x write, 1x read + 4x read (with explicit end)", async (t) => {
    const ifca = new IFCA(4, (x: {i: number}) => {t.log('Processing', x); return x});

    for (let i = 0; i < 8; i++) {
        ifca.write({i});
    }
    // ifca.end();

    const first = await ifca.read()
    t.log('Got', first)
    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];
    const next4 = await Promise.all(read4);
    t.log('Got:', next4)

    const results = [first, ...next4]
    t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3},{i: 4}], "Should pass elements unchanged");
});

test("Identity function, 8x write, 1x read + 4x read (without explicit end)", async (t) => {
    const ifca = new IFCA(4, (x: {i: number}) => {t.log('Processing', x); return x});

    for (let i = 0; i < 8; i++) {
        ifca.write({i});
    }

    const first = await ifca.read()
    t.log('Got', first)
    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];
    const next4 = await Promise.all(read4);
    t.log('Got:', next4)

    const results = [first, ...next4]
    t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3},{i: 4}], "Should pass elements unchanged");
});

test("Overflow reads", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    const read8: MaybePromise<number|null>[] = [];
    for (let i = 0; i < 8; i++) {
        const ret = ifca.read();
        read8.push(ret);
        t.log("r", ifca.status, ret)
    }

    for (let i = 0; i < 8; i++) {
        ifca.write(i);
        t.log("w", ifca.status)
    }
    ifca.end();

    const results: (null|number)[] = [];
    for (const x of read8) {
        t.log(x);
        results.push(await x);
    }

    t.deepEqual(results, [1,2,3,4,5,6,7,8], "Should work well");
});

test("Overflow writes. Read 8 x 2", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end(); // without ifca.end() -> Error: Promise returned by test never resolved

    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const first8 = await Promise.all(read8);

    const another8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const second8 = await Promise.all(another8);

    const results = [...first8, ...second8];

    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12,null,null,null,null], "Should work well");
});

test("Overflow writes Write: 5x Read: 3x Max Parallel: 2", async(t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 5; i++) {
        ifca.write(i);
    }
    // ifca.end();

    const read3 = [ifca.read(), ifca.read(), ifca.read()];
    const first3 = await Promise.all(read3);
    const results = [...first3];
    t.deepEqual(results, [1,2,3]);
})

// Same as above.
test("Overflow writes. Read 7x + read 9x", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end(); // without ifca.end() -> Error: Promise returned by test never resolved

    const read7 = [ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()];
    t.log(read7);
    const first7 = await Promise.all(read7);

    const another9 = [ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()];
    const second9 = [];
    for (const next of another9) {
        const val = await next;
        t.log(val, ifca.status);
        second9.push(val);
    }

    const results = [...first7, ...second9];
    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12,null,null,null,null], "Should work well");
});

test("Overflow writes. Read 4x (with end)", async (t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }
    ifca.end();

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read4);

    t.deepEqual(results, [1,2,3,4], "Should work well");
});

test("Overflow writes. Read 4x (without end)", async (t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read4);

    t.deepEqual(results, [1,2,3,4], "Should work well");
});

test("Overflow writes. Read 12x (with end)", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end();

    const read12 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read12);

    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12], "Should work well");
});

test("Overflow writes. Read 12x (without end)", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    ifca.end();

    const read12 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read12);

    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12], "Should work well");
});

test("Write. Read. Write. Read", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }

    const read4 = [ ifca.read(), ifca.read(), ifca.read(), ifca.read() ];

    for (let i = 4; i < 8; i++) {
        ifca.write(i);
    }
    // ifca.end();

    const another4 = [ ifca.read(), ifca.read(), ifca.read(), ifca.read() ];

    const first4 = await Promise.all(read4);
    const second4 = await Promise.all(another4);

    const results = [...first4, ...second4];

    t.deepEqual(results, [1,2,3,4,5,6,7,8], "Should work well");

});

test("Overflow writes with read 2x (lower than max parallel(4)) repeated 6 times", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    // ifca.end();

    let results:any[] = [];

    for (let j = 0; j < 6; j++) {
        const read2 = [ ifca.read(), ifca.read() ];
        const result = await Promise.all(read2);
        results = [...results, ...result]
    }
    t.deepEqual(results, [1,2,3,4,5,6,7,8,9,10,11,12], "Should work well");
});

test("Ending IFCA more than once throws an error", async (t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }

    ifca.end();

    t.throws(ifca.end);
});

test("Writitng null chunk to IFCA triggers end", async (t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    const whenEnded = ifca.whenEnded();

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }

    ifca.write(null);

    await whenEnded;

    t.pass();
});

test("Writitng to IFCA after it's ended throws an error", async (t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }

    await ifca.end();

    t.throws(() => {ifca.write(4)});
});

test("Drain is emitted and resolved correctly", async (t) => {
    // maxParellel === 2, means 2 chunks can be processed in the same time,
    // this means second write should return promise.
    const ifca = new IFCA(2, (x: number) => x*10);

    const drains1: Array<Promise<void> | void | string> = [];
    for (let i = 0; i < 4; i++) {
        drains1.push(ifca.write(i));
    }

    markWhenResolved(drains1, 1);
    markWhenResolved(drains1, 2);
    markWhenResolved(drains1, 3);

    // processing queue [0, 1, 2, 3]
    t.deepEqual({pending: 4}, ifca.state);
    t.deepEqual(mapDrainsArray(drains1), [undefined, "Promise", "Promise", "Promise"]);

    // read first chunk
    t.deepEqual(await ifca.read(), 0);

    // processing queue [1, 2, 3]
    t.deepEqual({pending: 3}, ifca.state);
    t.deepEqual(mapDrainsArray(drains1), [undefined, "Promise", "Promise", "Promise"]);

    // read second chunk
    t.deepEqual(await ifca.read(), 10);

    // processing queue [2, 3]
    t.deepEqual({pending: 2}, ifca.state);
    t.deepEqual(mapDrainsArray(drains1), [undefined, "Promise", "Promise", "Promise"]);

    // read third chunk
    t.deepEqual(await ifca.read(), 20);

    // processing queue [3]
    t.deepEqual({pending: 1}, ifca.state);
    t.deepEqual(mapDrainsArray(drains1), [undefined, "ResolvedPromise", "ResolvedPromise", "ResolvedPromise"]);

    const drains2: Array<Promise<void> | void | string> = [];
    for (let i = 100; i < 103; i++) {
        drains2.push(ifca.write(i));
    }

    markWhenResolved(drains2, 0);
    markWhenResolved(drains2, 1);
    markWhenResolved(drains2, 2);

    // processing queue [3, 100, 101, 102]
    t.deepEqual({pending: 4}, ifca.state);
    t.deepEqual(mapDrainsArray(drains2), ["Promise", "Promise", "Promise"]);

    // read fourth chunk
    t.deepEqual(await ifca.read(), 30);

    // processing queue [100, 101, 102]
    t.deepEqual({pending: 3}, ifca.state);
    t.deepEqual(mapDrainsArray(drains2), ["Promise", "Promise", "Promise"]);

    // read fifth chunk
    t.deepEqual(await ifca.read(), 1000);

    // processing queue [101, 102]
    t.deepEqual({pending: 2}, ifca.state);
    t.deepEqual(mapDrainsArray(drains2), ["Promise", "Promise", "Promise"]);

    // read sixth chunk
    t.deepEqual(await ifca.read(), 1010);

    // processing queue [102]
    t.deepEqual({pending: 1}, ifca.state);
    t.deepEqual(mapDrainsArray(drains2), ["ResolvedPromise", "ResolvedPromise", "ResolvedPromise"]);

    // read last chunk
    t.deepEqual(await ifca.read(), 1020);

    // processing queue []
    t.deepEqual({pending: 0}, ifca.state);
    t.deepEqual(mapDrainsArray(drains2), ["ResolvedPromise", "ResolvedPromise", "ResolvedPromise"]);
});

test("Drain is resolved correctly on end", async (t) => {
    const ifca = new IFCA(2, (x: number) => x*10);

    const drains1: Array<Promise<void> | void | string> = [];
    for (let i = 0; i < 4; i++) {
        drains1.push(ifca.write(i));
    }

    markWhenResolved(drains1, 1);
    markWhenResolved(drains1, 2);
    markWhenResolved(drains1, 3);

    // processing queue [0, 1, 2, 3]
    t.deepEqual({pending: 4}, ifca.state);
    t.deepEqual(mapDrainsArray(drains1), [undefined, "Promise", "Promise", "Promise"]);

    await ifca.end();

    // processing queue []
    t.deepEqual({pending: 0}, ifca.state);
    t.deepEqual(mapDrainsArray(drains1), [undefined, "ResolvedPromise", "ResolvedPromise", "ResolvedPromise"]);
});

function markWhenResolved(items: Array<any>, index: number) {
    (items[index] as Promise<void>).then(() => {
        console.log('RESOLVED-----', index);
        items[index] = "ResolvedPromise";
    });
}

function mapDrainsArray(drains: Array<any>) {
    return drains.map(drain => drain instanceof Promise ? "Promise" : drain);
}

// // npm run build && npx ava test/test.spec.js -m "*chunks are not present on output*"
// test("Dropped chunks are not present on output (strict sync chain)", async (t) => {
//     const filter = (x: number) => { t.log("Processing", x); return x % 2 ? x : DroppedChunk; };
//     const ifca = new IFCA(4, filter, { strict: true });

//     for (let i = 0; i <= 3; i++) {
//         ifca.write(i);
//     }

//     const read12 = [
//         ifca.read(), ifca.read(), ifca.read(), ifca.read()
//     ];
//     const results = await Promise.all(read12);

//     t.log("Output:", results);

//     t.deepEqual(results, [1,3], "Should pass elements unchanged");
// });

// // // Works fine!
// // test("Dropped chunks are not passed to further transforms (strict sync chain)", async (t) => {
// //     const filter = (x: number) => { t.log("Processing", x); return x % 2 ? x : DroppedChunk; };
// //     const ifca = new IFCA(4, filter, { strict: true });
// //     const transformChunks: number[] = [];

// //     ifca.addTransform((x: any): any => {
// //         transformChunks.push(x);
// //         return x;
// //     });

// //     for (let i = 0; i <= 3; i++) {
// //         ifca.write(i);
// //     }

// //     await Promise.all([ifca.read(), ifca.read(), ifca.read(), ifca.read()]);

// //     t.deepEqual(transformChunks, [1, 3], "Should pass elements unchanged");
// // });

// // // dropped chunks sync strict
// // // dropped chunks sync + async strict
// // // dropped chunks async
// // // dropped chunks are not processed further
// // // dropped chunks are skipped in the output
// // // all dropped chunks still ends ifca
// // // all with setTimeout to make promises resolve
