#!/usr/bin/env python
import asyncio
import websockets
import sys

# WS client example

PORT = 8080
namesNr = sys.argv[1] if len(sys.argv) > 1 else "10"

async def get_names(uri):
    async with websockets.connect(uri) as websocket:
        print(f"Requesting {namesNr} random names...")
        await websocket.send(namesNr)

        counter = 1
        async for message in websocket:
            print(f"<<< {counter}. {message}")
            counter += 1

asyncio.run(get_names(f"ws://localhost:{PORT}"))