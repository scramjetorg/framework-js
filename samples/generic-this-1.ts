// This is a sample file demonstarting the approached used for "polymorphic this"
// for generic method inheritance. It can be run with:
//
//     npm run build && node build/samples/generic-this-1.js"

class BaseClass<T> {
    public value: T;

    constructor(value: T) {
        this.value = value;
    }

    create(value: T): BaseClass<T>;
    create<U>(value: U): BaseClass<U>;
    create<U extends any>(value: U): BaseClass<U> {
        return new BaseClass<U>(value);
    }

    method1(): this {
        return this;
    }

    method2(): BaseClass<T> {
        return this;
    }

    method3(value: T): BaseClass<T> {
        return this.create<T>(value);
    }

    method5(value: T): BaseClass<T>;
    method5<U>(value: U): BaseClass<U>;
    method5<U extends any>(value: U): BaseClass<U> {
        return this.create<U>(value);
    }
}

class DerivedClass<T> extends BaseClass<T> {
    create(value: T): DerivedClass<T>;
    create<U>(value: U): DerivedClass<U>;
    create<U extends any>(value: U): DerivedClass<U> {
        return new DerivedClass<U>(value);
    }

    method2(): DerivedClass<T> {
        return super.method2() as DerivedClass<T>;
    }

    method3(value: T): DerivedClass<T> {
        return super.method3(value) as DerivedClass<T>;
    }

    method5(value: T): DerivedClass<T>;
    method5<U>(value: U): DerivedClass<U>;
    method5<U>(value: U): DerivedClass<U> {
        return super.method5(value) as DerivedClass<U>;
    }

    ownMethod1() {
        console.log(this);
    }
}

class DerivedClassFixedType extends DerivedClass<number> {
    create(value: number): DerivedClassFixedType {
        return new DerivedClassFixedType(value);
    }

    method2(): DerivedClassFixedType {
        return super.method2() as DerivedClassFixedType;
    }

    method3(value: number): DerivedClassFixedType {
        return super.method3(value) as DerivedClassFixedType;
    }

    method5(value: number): DerivedClassFixedType {
        return super.method5(value) as DerivedClassFixedType;
    }

    ownMethod2() {
        console.log(this);
    }
}

class BaseClassFixedType extends BaseClass<string> {
    create(value: string): BaseClassFixedType {
        return new BaseClassFixedType(value);
    }

    method2(): BaseClassFixedType {
        return super.method2() as BaseClassFixedType;
    }

    method3(value: string): BaseClassFixedType {
        return super.method3(value) as BaseClassFixedType;
    }

    method5(value: string): BaseClassFixedType {
        return super.method5(value) as BaseClassFixedType;
    }

    ownMethod3() {
        console.log(this);
    }
}

// --- BaseClass

const bcString = new BaseClass("foo");
const bcString1 = bcString.method1();
const bcString2 = bcString.method2();
const bcString3 = bcString.method3("bar");
const bcString5 = bcString.method5(123);

for (const instance of [bcString, bcString1, bcString2, bcString3, bcString5]) {
    console.log(`instanceof: ${ instance instanceof BaseClass }; constructor.name: ${ instance.constructor.name }`);
}

// --- DerivedClass

const dcString = new DerivedClass("foo");
const dcString1 = dcString.method1();
const dcString2 = dcString.method2();
const dcString3 = dcString.method3("bar");
const dcString5 = dcString.method5(123);

for (const instance of [dcString, dcString1, dcString2, dcString3, dcString5]) {
    console.log(`instanceof: ${ instance instanceof DerivedClass }; constructor.name: ${ instance.constructor.name }`);
}

dcString.ownMethod1();
dcString1.ownMethod1();
dcString2.ownMethod1();
dcString3.ownMethod1();
dcString5.ownMethod1();

// --- DerivedClassFixedType

const dcftString = new DerivedClassFixedType(123);
const dcftString1 = dcftString.method1();
const dcftString2 = dcftString.method2();
const dcftString3 = dcftString.method3(456);
const dcftString5 = dcftString.method5(123);

for (const instance of [dcftString, dcftString1, dcftString2, dcftString3, dcftString5]) {
    console.log(`instanceof: ${ instance instanceof DerivedClassFixedType }; constructor.name: ${ instance.constructor.name }`);
}

dcftString.ownMethod2();
dcftString1.ownMethod2();
dcftString2.ownMethod2();
dcftString3.ownMethod2();
dcftString5.ownMethod2();

// --- BaseClassFixedType

const bcftString = new BaseClassFixedType("foo");
const bcftString1 = bcftString.method1();
const bcftString2 = bcftString.method2();
const bcftString3 = bcftString.method3("bar");
const bcftString5 = bcftString.method5("baz");
// const toBcStrign6 = bcftString.method5(123); // This won't work for now

for (const instance of [bcftString, bcftString1, bcftString2, bcftString3, bcftString5]) {
    console.log(`instanceof: ${ instance instanceof BaseClassFixedType }; constructor.name: ${ instance.constructor.name }`);
}

bcftString.ownMethod3();
bcftString1.ownMethod3();
bcftString2.ownMethod3();
bcftString3.ownMethod3();
bcftString5.ownMethod3();
