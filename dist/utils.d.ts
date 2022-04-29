import { ResolvablePromiseObject, TransformHandler } from "./types";
declare function trace(msg: any, ...array: any[]): void;
declare function createResolvablePromiseObject<T>(): ResolvablePromiseObject<T>;
declare function isAsyncFunction(func: any): boolean;
declare function isAsyncTransformHandler(func: TransformHandler<any, any>): boolean;
declare function getId(prefix: string): string;
export { trace, createResolvablePromiseObject, isAsyncFunction, isAsyncTransformHandler, getId };
