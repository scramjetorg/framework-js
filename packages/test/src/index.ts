import { deepStrictEqual } from "node:assert";

export const it = "'s alive!"

export type TransformFunction<V,U> = (chunk: V) => (Promise<U>|U)

export interface IFCA<T,S> {
    maxParallel: number;
    transforms: TransformFunction<any,any>[];

    addChunk(chunk: T): {value: Promise<S>, drain?: Promise<void>}
    last(): Promise<S>

    // TODO: destroy(e: Error): void;

    addTransform<W>(tr: TransformFunction<S,W>): IFCA<T,W>;
    removeTransform<W>(tr: TransformFunction<W,S>): IFCA<T,W>;
}

const x: IFCA<string, string> = null as any;

let y = x
    .addTransform((str) => ({x: +str}))
    .addTransform(({x}) => x)
;

const data: string[] = ["1", "2", "3", "4"];
const out: number[] = [];

for (const chunk of data) {
    const {value, drain} = y.addChunk(chunk);
    
    if (drain) await drain;
    if (value instanceof Promise) {
        value.then((data) => out.push(data));
        // TODO: error handling
    } else {
        out.push(value);
    }
}

await y.last();

deepStrictEqual(out, [1,2,3,4]);