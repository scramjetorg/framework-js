import {createReadStream} from 'fs';

async function stream_file(path, chunkLimit=20) {
  console.log(`\nOpening file ${path}`)
  var stream = createReadStream(path);
  var counter = 0

  for await (const chunk of stream) {
    console.log(chunk.length)

    counter++
    if (counter > chunkLimit) {
      console.log('...')
      break
    }
  }
}

await stream_file('./large-text-file-with-newlines.txt')

await stream_file('./large-continuous-text-file.txt')