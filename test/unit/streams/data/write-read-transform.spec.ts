import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";
import { defer } from "../../../_helpers/utils";

test("Write/read works correctly after map transform is used", async (t) => {
    const ds = new DataStream<number>({ maxParallel: 2 });
    const dsMap = ds.map(chunk => `foo-${ chunk }`);
    const dsWriteResult = ds.write(1); // should work
    const dsMapWriteResult = dsMap.write(2); //should work

    // Defer since values are available asynchronously in the next tick.
    await defer(0);

    const dsReadResult = ds.read(); // should throw an errpr
    const dsMapReadResult = dsMap.read(); // should work

    t.deepEqual([dsWriteResult, dsMapWriteResult, dsReadResult, dsMapReadResult],
        [true, true, "foo-1", "foo-2"]);


    // t.deepEqual(await dsMap.toArray(), ["foo-1", "foo-2"]);
});
