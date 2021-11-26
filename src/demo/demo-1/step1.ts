// Run with: npm run dist && node dist/src/demo/demo-1/step1.js

import { DataStream } from "../../streams/data-stream";
import { FRUITS, VEGGIES } from "../foods";

(async () => {
    await DataStream
        .from(["ffv"], { maxParallel: 10 })
        .map(x => x.repeat(5))
        .flatMap(chunk => chunk.split(""))
        .map(chunk => chunk === "v"
            ? VEGGIES[Math.floor(Math.random() * VEGGIES.length)]
            : FRUITS[Math.floor(Math.random() * FRUITS.length)]
        )
        .each(console.log)
        .run();
})();
