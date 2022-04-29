"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFCAChain = void 0;
const ifca_1 = require("../ifca");
class IFCAChain {
    constructor() {
        this.chain = [];
    }
    get length() {
        return this.chain.length;
    }
    create(options) {
        const ifca = new ifca_1.IFCA(options);
        this.chain.push(ifca);
        return ifca;
    }
    add(ifca) {
        if (this.chain[this.chain.length - 1] !== ifca) {
            this.chain.push(ifca);
        }
    }
    get() {
        return this.chain[this.chain.length - 1];
    }
    write(chunk) {
        return this.chain[0].write(chunk);
    }
    read() {
        return this.chain[this.chain.length - 1].read();
    }
    end() {
        return this.chain[0].end();
    }
}
exports.IFCAChain = IFCAChain;
//# sourceMappingURL=ifca-chain.js.map