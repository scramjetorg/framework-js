import { DataStream } from "../../streams/data-stream";

const FRUITS = ["🍎", "🍐", "🍊", "🍌", "🥑"];
const VEGGIES = ["🥦", "🍅", "🥬", "🥕", "🍆"];

(async () => {
    const result = await DataStream
        .from(["ffv"], { maxParallel: 10 })
        .map(x => x.repeat(20))
        .flatMap(chunk => chunk.split(""))
        .map(chunk => chunk === "v"
            ? VEGGIES[Math.floor(Math.random() * VEGGIES.length)]
            : FRUITS[Math.floor(Math.random() * FRUITS.length)]
        )
        // .each(console.log)
        // .run();
        .toArray();

    console.log(result);
})();
