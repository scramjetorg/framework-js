import { DataStream } from "@scramjet/framework";

(async () => {
    const result = await DataStream
        .from(["It", "works", "!"])
        .map(item => item.toUpperCase())
        .reduce((prev, next) => `${prev} ${next}`);

    console.log(result);
})();
