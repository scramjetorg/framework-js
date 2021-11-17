// 1. zakładam, że read, write, end są synchroniczne tak jak w native nodejs streams.
// 2. jaka ma być kolejność chunków przy .from, .write, .write, ...?
// 3. Czy read ma automatycznie uncorkować stream? Co z:
//     > The readable.read() method should only be called on Readable streams operating in paused
//     > mode. In flowing mode, readable.read() is called automatically until the internal buffer is fully drained.
//
//     > The readable.resume() method can be used to fully consume the data from a stream
//     > without actually processing any of that data:
//
//     > The readable.pause() method will cause a stream in flowing mode to stop emitting 'data' events,
//     > switching out of flowing mode. Any data that becomes available will remain in the internal buffer.
//
//     > When the Readable is operating in paused mode, the data added with readable.push() can be read
//     > out by calling the readable.read() method when the 'readable' event is emitted.
//
//     > When the Readable is operating in flowing mode, the data added with readable.push() will be
//     >delivered by emitting a 'data' event.
//
// Czy `from` powinno tworzyć zakorkowany stream a konstrutkor odkorkowany?

// Eryk i filter - typowanie na poziomie kompilacji i filtrowanie (filtrowanie może ale nie musi zwórcić value
// i składanie transformat na poziomie kompilacji się rozwala przez to).
//
//
