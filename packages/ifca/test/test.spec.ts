import test from "ava";
import { IFCA } from "../lib/index";

type MaybePromise<X> = Promise<X>|X;

test("Identity function, numbers starting from 1", async (t) => {
    const ifca = new IFCA(4, (x: number) => {t.log('Processing', x); return x});

    for (let i = 1; i <= 4; i++) {
        ifca.write(i);
    }
    // /* No end needed: */ ifca.end();

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];
    const results = await Promise.all(read4);
    t.log('Output:', results)

    t.deepEqual(results, [1,2,3,4], "Should pass elements unchagned");
});

test("Identity function, objects starting from 0", async (t) => {
    const ifca = new IFCA(4, (x: {i: number}) => {t.log('Processing', x); return x; });

    for (let i = 0; i < 4; i++) {
        ifca.write({i});
    }
    // /* No end needed: */ ifca.end();

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];
    const results = await Promise.all(read4);
    t.log('Output:', results)

    t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3}], "Should pass elements unchagned");
});

// TODO: skipped, 0 is skipped in IFCA.
test("Identity function, numbers starting from 0", async (t) => {
    const ifca = new IFCA(4, (x: number) => {t.log('Processing', x); return x; });

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }
    // /* No end needed: */ ifca.end();

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
    ];
    const results = await Promise.all(read4);
    t.log('Output:', results)

    t.deepEqual(results, [0,1,2,3], "Should pass elements unchagned");
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
    // /* No end needed: */ ifca.end();

    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(),
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read8)
    t.log('Output:', results)
    const expected = [null, 0, false, '', undefined, NaN, null, 0]

    t.deepEqual(results, expected, "Falsy values in output shouldn't be treated specially");
});

test("Identity function, 4x write, 8x read", async (t) => {
    const ifca = new IFCA(4, (x: {i: number}) => {t.log('Processing', x); return x});

    for (let i = 0; i < 4; i++) {
        ifca.write({i});
    }
    await ifca.end(); // Must await in order to get correct results

    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), 
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read8);
    t.log('Output:', results)

    t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3},null,null,null,null], "Should first output chunks matching inputs, then nulls");
});

test("Identity function, 8x write, 1x read + 4x read", async (t) => {
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
    t.deepEqual(results, [{i: 0},{i: 1},{i: 2},{i: 3},{i: 4}], "Should pass elements unchagned");
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
    const whenEnd = ifca.end(); // without ifca.end() -> Error: Promise returned by test never resolved
    
    const read8 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read(), ifca.read() 
    ];
    const first8 = await Promise.all(read8);

    t.log(whenEnd);

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

test("Overflow writes. Read 4x", async (t) => {
    const ifca = new IFCA(2, (x: number) => x+1);

    for (let i = 0; i < 4; i++) {
        ifca.write(i);
    }
    // ifca.end();

    const read4 = [
        ifca.read(), ifca.read(), ifca.read(), ifca.read()
    ];
    const results = await Promise.all(read4);

    t.deepEqual(results, [1,2,3,4], "Should work well");
});


// This used to work. Now I've got: Error: Promise returned by test never resolved
test("Overflow writes. Read 12x", async (t) => {
    const ifca = new IFCA(4, (x: number) => x+1);

    for (let i = 0; i < 12; i++) {
        ifca.write(i);
    }
    // ifca.end();

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

// Works okay now
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