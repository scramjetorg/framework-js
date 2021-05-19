"use strict";
// import { deepStrictEqual } from "assert";
exports.__esModule = true;
exports.Algorithm = void 0;
var Algorithm = /** @class */ (function () {
    function Algorithm(maxParallel, transforms) {
        this.maxParallel = maxParallel;
        this.transforms = transforms;
    }
    Algorithm.prototype.addChunk = function (_chunk) {
        throw new Error("Method not implemented.");
    };
    Algorithm.prototype.last = function () {
        throw new Error("Method not implemented.");
    };
    Algorithm.prototype.addTransform = function (_tr) {
        throw new Error("Method not implemented.");
    };
    Algorithm.prototype.removeTransform = function (_tr) {
        throw new Error("Method not implemented.");
    };
    return Algorithm;
})();
exports.Algorithm = Algorithm;
// deepStrictEqual(out, [1,2,3,4]);
