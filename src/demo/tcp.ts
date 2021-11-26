import net from "net";

const server = net.createServer(socket => {
    console.log("Request received...");

    socket.on("error", (err) => {
        console.log(err.stack);
    });
});

server.listen(9616, "172.20.10.131", () => {
    console.log("Server started on 172.20.10.131:9616");
});
