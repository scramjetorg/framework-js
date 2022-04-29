"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTransformability = void 0;
function checkTransformability(target, propertyKey, descriptor) {
    const originalValue = descriptor.value;
    descriptor.value = function (...args) {
        if (!this.transformable) {
            throw new Error("Stream is not transformable.");
        }
        return originalValue.apply(this, args);
    };
}
exports.checkTransformability = checkTransformability;
//# sourceMappingURL=decorators.js.map