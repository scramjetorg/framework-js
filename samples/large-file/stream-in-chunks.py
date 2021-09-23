def stream_file(path, chunk_size=1024, chunk_limit=20):
    print(f"\nOpening file {path}")
    counter = 0
    stream = open(path, "r")

    for chunk in iter(lambda: stream.read(chunk_size), ''):
        print(f"Read chunk, length {len(chunk)}")

        counter += 1
        if counter > chunk_limit:
            print('...')
            break


stream_file('./large-text-file-with-newlines.txt')

stream_file('./large-continuous-text-file.txt')
