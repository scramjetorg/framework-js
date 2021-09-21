# Random Names Websocket

Sample shows how to create a websocket server which will send number of different names to a client when requested.

Install dependencies first:

```bash
npm i
```

**Any client type can be run with any server type!**

## Simple

Sample using simplest approach with [ws module](https://www.npmjs.com/package/ws).

Run both server and client (or multiple clients) like:

```bash
npm run server:simple
npm run client:simple [nr] # [nr=10] - number of names to request
```

## Client using streams

WebSocket communictaion is wrapped into Duplex stream.

```bash
npm run client:streams [nr] # [nr=10] - number of names to request
```

## Client using Scramjet

WebSocket communication is wrapped into Scramjet StringStream (through native Duplex stream).

```bash
npm run client:scramjet [nr] # [nr=10] - number of names to request
```
