import test from "ava";
import { IFCA } from "../../../src/ifca";
import { IFCAChain } from "../../../src/ifca/ifca-chain";

test("Same IFCA instance would not be duplicated on the IFCAChain end when added twice", async (t) => {
    const ifca = new IFCA<number>({});
    const ifcaChain = new IFCAChain<number>();

    t.is(ifcaChain.length, 0);

    ifcaChain.add(ifca);
    ifcaChain.add(ifca);

    t.is(ifcaChain.length, 1);

    ifcaChain.create({});

    t.is(ifcaChain.length, 2);
});
