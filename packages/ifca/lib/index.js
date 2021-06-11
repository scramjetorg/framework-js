"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.IFCA = void 0;
var IFCA = /** @class */ (function () {
    // static processing: PromiseLike<S>[] = [];
    function IFCA(maxParallel) {
        this.transforms = [];
        this.processing = [];
        this.readable = [];
        this.maxParallel = maxParallel;
    }
    IFCA.prototype.write = function (_chunk) {
        var _this = this;
        console.log('');
        console.log('WRITE.....');
        this.readable.push();
        var drain = this.processing.length < this.maxParallel ? undefined : this.processing[this.processing.length - this.maxParallel];
        var value = new Promise(function (res) { return __awaiter(_this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, drain];
                    case 1:
                        _a.sent();
                        result = this.transforms.reduce(function (prev, transform) { return prev.then(transform.bind(_this)); }, Promise.resolve(_chunk));
                        return [2 /*return*/, res(result)];
                }
            });
        }); });
        console.log('ADD TO PROCESSING... chunk: ' + JSON.stringify(_chunk));
        this.processing.push(value);
        console.log('write pre then... this.processing.length: ' + this.processing.length);
        var idx = this.processing.length - 1;
        value.then(function (res) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('');
                        console.log('INDEX:' + idx + ' VALUE READY chunk: ' + JSON.stringify(_chunk) + ' value: ' + JSON.stringify(res));
                        if (!drain) return [3 /*break*/, 2];
                        return [4 /*yield*/, drain];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // this.processing.shift();
                        // this.readable[this.index] = res;
                        this.readable[idx] = res;
                        return [2 /*return*/];
                }
            });
        }); });
        // function generator(_index: number):Function {
        //    return function (resolve: Function) {
        //         if (drain) await drain;
        //         IFCA.processing.shift();
        //         this.readable[_index] = resolve;
        //     })
        //    };
        // };
        // value.then(generator(this.index));
        return { value: value };
    };
    IFCA.prototype.read = function (items) {
        console.log('READ: this.processing.length ' + this.processing.length + ' this.readable.length ' + this.readable.length);
        console.log('READ readable: ' + JSON.stringify(this.readable));
        if (this.processing.length === 0) {
            // NOTHING TO READ - TERMINATE AND RETURN NULL
            return null;
        }
        var result = [];
        var i = 0;
        for (i; i < items; i++) {
            if (this.readable[i]) {
                result.push(this.readable[i]);
            }
            else {
                break;
            }
        }
        this.processing.splice(0, i);
        console.log('POST READ: this.processing.length ' + this.processing.length + ' this.readable.length ' + this.readable.length);
        console.log('POST readable: ' + JSON.stringify(this.readable));
        return result;
    };
    IFCA.prototype.last = function () {
        return this.processing[this.processing.length - 1];
    };
    IFCA.prototype.addTransform = function (_tr) {
        this.transforms.push(_tr);
        return this;
    };
    // Remove transform (pop)
    IFCA.prototype.removeTransform = function () {
        this.transforms.pop();
        return this;
    };
    return IFCA;
}());
exports.IFCA = IFCA;
