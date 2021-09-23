import asyncio
import aiofiles

async def stream_file(path, chunk_size=1024, chunk_limit=20):
    print(f"\nOpening file {path}")
    counter = 0

    async with aiofiles.open(path, "r") as stream:
        async for chunk in stream:
            print(f"Read chunk, length {len(chunk)}")

            counter += 1
            if counter > chunk_limit:
                print('...')
                break


asyncio.run(stream_file('./large-text-file-with-newlines.txt'))

asyncio.run(stream_file('./large-continuous-text-file.txt'))
