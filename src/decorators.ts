export function checkTransformability(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalValue = descriptor.value;

    descriptor.value = function(...args: any[]) {
        if (!(this as any).transformable) {
            throw new Error("Stream is not transformable.");
        }

        return originalValue.apply(this, args);
    };
}
