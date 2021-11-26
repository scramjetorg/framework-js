
import net from "net";
import { deferReturn } from "../../../test/_helpers/utils";
import { DataStream } from "../../streams/data-stream";

const FRUITS = ["🍎", "🍐", "🍊", "🍌", "🥑"];
const VEGGIES = ["🥦", "🍅", "🥬", "🥕", "🍆"];

const server = net.createServer(socket => {
    console.log("Request received...");

    socket.on("error", (err) => {
        console.log(err);
    });

    const stream = DataStream
        .from(["ffv"], { maxParallel: 10 })
        .map(x => x.repeat(20))
        .flatMap(chunk => chunk.split(""))
        .map(chunk => chunk === "v"
            ? VEGGIES[Math.floor(Math.random() * VEGGIES.length)]
            : FRUITS[Math.floor(Math.random() * FRUITS.length)]
        );

    const veggies = new DataStream<string>({ maxParallel: 1 })
        .filter(chunk => VEGGIES.includes(chunk))
        .each(console.log)
        .flatMap(chunk => Buffer.from(chunk))
        .map(async chunk => deferReturn(1000, Buffer.from([chunk])))
        .each(chunk => console.log("Sending:", chunk));

    stream.pipe(veggies).pipe(socket);
});

server.listen(9616, "172.20.10.131", () => {
    console.log("Server started on 172.20.10.131:9616");
});
