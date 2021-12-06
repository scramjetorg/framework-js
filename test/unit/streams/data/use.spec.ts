import test from "ava";
import { DataStream } from "../../../../src/streams/data-stream";
import { StringStream } from "../../../../src/streams/string-stream";

test("DataStream use correctly uses passed callback (returns new stream instance)", async (t) => {
    const data = ["$8", "$25", "$3", "$14", "$20", "$9", "$13", "$16"];
    const stream = DataStream.from(data, { maxParallel: 4 });

    const parseSquareEvenDollars = (streamInstance: DataStream<string>) => {
        return streamInstance
            .map(chunk => parseInt(chunk.replace("$", ""), 10))
            .filter(chunk => chunk % 2 === 0)
            .map(chunk => chunk ** 2)
            .map(chunk => `$${ chunk }`);
    };

    const newStream = stream.use(parseSquareEvenDollars);
    const result = await newStream.toArray();

    t.deepEqual(result, ["$64", "$196", "$400", "$256"]);
});

test("DataStream use correctly uses passed callback (returns array)", async (t) => {
    const data = ["$8", "$25", "$3", "$14", "$20", "$9", "$13", "$16"];
    const stream = DataStream.from(data, { maxParallel: 4 });

    const parseSquareEvenDollars = (streamInstance: DataStream<string>) => {
        return streamInstance.toArray();
    };

    const result = await stream.use(parseSquareEvenDollars);

    t.deepEqual(result, ["$8", "$25", "$3", "$14", "$20", "$9", "$13", "$16"]);
});

test("DataStream use correctly uses passed callback (returns new stream instance, StringStream)", async (t) => {
    const data = ["$8", "$25", "$3", "$14", "$20", "$9", "$13", "$16"];
    const stream = StringStream.from(data, { maxParallel: 4 });

    const parseSquareEvenDollars = (streamInstance: StringStream) => {
        return streamInstance
            .filter(chunk => chunk.length > 2);
    };

    const newStream = stream
        .use(parseSquareEvenDollars)
        .match(/\$1\d+/g);

    t.deepEqual(await newStream.toArray(), ["$14", "$13", "$16"]);
});
