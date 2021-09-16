#!/usr/bin/env python
import asyncio
import websockets
import names

# WS server example

PORT = 8080

async def send_names(websocket, path):
    data = await websocket.recv()
    print(f"<<< {data}")
    count = int(data)

    for _ in range(count):
        name = names.get_full_name()
        await websocket.send(name)
        print(f">>> {name}")

async def main():
    async with websockets.serve(send_names, "localhost", PORT):
        await asyncio.Future()  # run forever

asyncio.run(main())