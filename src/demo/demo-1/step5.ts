// Run with:
// npm run dist && node dist/src/demo/demo-1/step5.js
// telnet 172.20.10.131 9616

import net from "net";
import { deferReturn } from "../../../test/_helpers/utils";
import { DataStream } from "../../streams/data-stream";
import { FRUITS, VEGGIES } from "../foods";

const HOST = "172.20.10.131";
const PORT = 9616;

const server = net.createServer(socket => {
    console.log("Request received...");

    socket.on("error", (err) => {
        console.log(err);
    });

    const stream = DataStream
        .from(["ffv"], { maxParallel: 10 })
        .map(x => x.repeat(10))
        .flatMap(chunk => chunk.split(""))
        .map(chunk => chunk === "v"
            ? VEGGIES[Math.floor(Math.random() * VEGGIES.length)]
            : FRUITS[Math.floor(Math.random() * FRUITS.length)]
        );

    const type = Math.random() > 0.5 ? VEGGIES : FRUITS;
    const all = new DataStream<string>({ maxParallel: 1 })
        .filter(chunk => type.includes(chunk))
        .each(console.log)
        .flatMap(chunk => Buffer.from(chunk))
        .batch((chunk, state) => { state.counter++; return state.counter % 3 === 0; }, { counter: 0 })
        .map(async chunk => deferReturn(1000, Buffer.from(chunk)))
        .each(chunk => console.log("Sending:", chunk));

    stream.pipe(all).pipe(socket);
});

server.listen(PORT, HOST, () => {
    console.log(`Server started on ${ HOST }:${ PORT }`);
});
