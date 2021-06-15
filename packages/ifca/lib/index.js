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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
exports.__esModule = true;
exports.IFCA = void 0;
var stream_1 = require("stream");
var os_1 = require("os");
var ProcessingItem = /** @class */ (function () {
    function ProcessingItem(proc) {
        var _this = this;
        this.done = false;
        this.processing = proc;
        proc.then(function (chunk) {
            _this.done = true;
            _this.read && _this.read(chunk);
        }, function (error) {
            _this.done = true;
            _this.error && _this.error(error);
        });
    }
    Object.defineProperty(ProcessingItem.prototype, "value", {
        /** @readonly */
        get: function () {
            var _this = this;
            return this.done
                ? this.processing
                : new Promise(function (res, rej) {
                    _this.read = res;
                    _this.error = rej;
                });
        },
        enumerable: false,
        configurable: true
    });
    return ProcessingItem;
}());
;
var IFCA = /** @class */ (function () {
    function IFCA(maxParallel) {
        this.transforms = [];
        this._maxParallel = 2 * os_1.cpus().length;
        this.queue = [];
        this.processing = [];
        this.readable = [];
        this.readers = [];
        this.maxParallel = maxParallel;
    }
    Object.defineProperty(IFCA.prototype, "maxParallel", {
        get: function () {
            return this._maxParallel;
        },
        set: function (value) {
            this._maxParallel = value;
        },
        enumerable: false,
        configurable: true
    });
    IFCA.prototype.write = function (_chunk) {
        return __awaiter(this, void 0, void 0, function () {
            var drain, chunkBeforeThisOne, currentChunkResult;
            var _this = this;
            return __generator(this, function (_a) {
                drain = this.processing.length < this.maxParallel
                    ? undefined
                    : this.queue[this.processing.length - this.maxParallel].done;
                chunkBeforeThisOne = this.processing[this.processing.length - 1];
                currentChunkResult = this.transforms
                    .reduce(function (prev, transform) { return prev.then(transform.bind(_this)); }, Promise.resolve(_chunk));
                this.queue.push(new ProcessingItem(Promise
                    .all([chunkBeforeThisOne, currentChunkResult])
                    .then(function (_a) {
                    var result = _a[1];
                    return result;
                })));
                return [2 /*return*/, drain];
            });
        });
    };
    IFCA.prototype.read = function (items) {
        var _this = this;
        var results = this.readable.splice(0, items);
        if (results.length === items)
            return stream_1.Readable.from(results);
        var resultPromises = (new Array(results.length - items))
            .fill(1)
            .map(function () { return new Promise(function (res) { return _this.readers.push(res); }); });
        return (function () {
            return __asyncGenerator(this, arguments, function () {
                var out;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(results)))];
                        case 1: return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            if (!true) return [3 /*break*/, 9];
                            return [4 /*yield*/, __await(resultPromises.shift())];
                        case 4:
                            out = _a.sent();
                            if (!!out) return [3 /*break*/, 6];
                            return [4 /*yield*/, __await(void 0)];
                        case 5: return [2 /*return*/, _a.sent()];
                        case 6: return [4 /*yield*/, __await(out)];
                        case 7: return [4 /*yield*/, _a.sent()];
                        case 8:
                            _a.sent();
                            return [3 /*break*/, 3];
                        case 9: return [2 /*return*/];
                    }
                });
            });
        })();
    };
    IFCA.prototype.last = function () {
        return this.processing[this.processing.length - 1];
    };
    IFCA.prototype.addTransform = function (_tr) {
        this.transforms.push(_tr);
        return this;
    };
    // Remove transform (pop)
    IFCA.prototype.removeTransform = function (_tr) {
        throw new Error("Method not implemented.");
    };
    return IFCA;
}());
exports.IFCA = IFCA;
