"use strict";
// import { deepStrictEqual } from "assert";
exports.__esModule = true;
exports.IFCA = void 0;
var IFCA = /** @class */ (function () {
    function IFCA(maxParallel) {
        this.transforms = [];
        this.processing = [];
        this.maxParallel = maxParallel;
    }
    IFCA.prototype.addChunk = function (_chunk) {
        var _this = this;
        var _drain;
        if (this.processing.length < this.maxParallel) {
            this.processing.push(_chunk);
            _drain = undefined;
        }
        else {
            // _drain = this.processing[this.processing.length - this.maxParallel]; // That's wrong!?
        }
        var value = new Promise(function (res) {
            console.log('promise chunk: ' + _chunk);
            var result = _this.transforms.reduce(function (prev, transform) { return transform.call(_this, prev); }, _chunk);
            return res(result);
        });
        console.log('value:');
        console.log(value);
        var drain = new Promise(function (res) {
            res(_drain);
        });
        return { value: value, drain: drain };
    };
    IFCA.prototype.last = function () {
        var _this = this;
        var value = new Promise(function (res) {
            var result = _this.transforms.reduce(function (prev, transform) { return transform.call(_this, prev); }, _this.processing[_this.processing.length - 1]);
            return res(result);
        });
        return value;
    };
    IFCA.prototype.addTransform = function (_tr) {
        this.transforms.push(_tr);
        return this;
    };
    IFCA.prototype.removeTransform = function (_tr) {
        throw new Error("Method not implemented.");
    };
    return IFCA;
}());
exports.IFCA = IFCA;
// deepStrictEqual(out, [1,2,3,4]);
