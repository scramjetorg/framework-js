# Types of streams

## What we have now (Scramjet v4)

Docs: https://github.com/scramjetorg/scramjet/blob/develop/.d.ts/index.d.ts

* `PromiseTransform` - internal base stream extedning native `Readable` / `Writable`.
* `DataStream` < `PromiseTransform` - primary stream type, like native `Array`. Can operate on chunks of any type.
* `BufferStream` < `DataStream` - stream operating on buffers, like native `node.Buffer`.
* `StringStream` < `DataStream` - stream operating on strings, like native `String`.
* `NumberStream` < `DataStream` - stream operating on numbers, like native `Number` (or more like `Number[]`?).
* `WindowStream` < `NumberStream` - stream for performing opeartions on grouped chunkes of data (like `Number[]` or `Number[][]`?).
* `MultiStream` - stream muxing/demuxing multiple streams, like `Stream[]`.

## Thoughts on v5

### Exisiting streams

* `DataStream<T>` as a base stream but implementing base interface (like `IDataStream`).
* `StringStream` extends `DataStream<String>` - Opearting on strings is very common for data processing IMHO, so this one is really important.
* `BufferStream` extends `DataStream<Buffer>` - probably useful when working with files, videos, etc for processing binary data. I guess this is for more "advanced" use cases. OTOH everything is binary data underneath so can be used to process anything in any way.
* `WindowStream<T>` extends `DataStream<T>` - Useful for using with time series calculating moving sth (averages, etc) or checking how data changes over time. I wouldn't limit it to numbers only - we can do stuff in window with strings or objects (or other complex structures too).
    * Should have `warmup` method/option to define that it should only emit full chunks.
* `MultiStream` - well, yes, muxing streams seems especially useful when gathering data from multiple sources and merging into one stream (e.g. gathering logs from multiple systems).
* `NumberStream` extends `DataStream<Number>` - could be, but now provides only aggregation functions (so kind of conviencne over regular reduce), not sure how useful it could be.

As for prioritizing I would start with base interface, `DataStream`, `StringStream` and `BufferStream` and then add remaining (and new) streams.

### New streams

Specialised types of streams we could add:

- `DuplexStream` - with dedicated methods to easily write/read. It's different than `MultiStream` because it's not used for (de)muxing but two way processing.
- `Key/Value stream` - each chunk would be `key: value`. I think it might be useful for processing data to/from NoSQL databases (especially key-value based obviosuly).
- `File stream` (so each file is a single chunk), for example could be used to batch process images (e.g. greyscaling, resizing, etc). Should support globbing.
    - `Resource stream` - more abstract file stream, providing a way to work with remote filesystems (like AWS, Dropbox, etc).
- `AST stream` - accepts a structure-like "thing" (as string? or already parsed?), anything which can be parsed to AST (XML, HTML, JS, etc.) on input and then each tree node could be a single chunk. AST is a tree strucutre and not flat one so it would require traversing and emitting chunks with BFS or DFS approach (if it makes any sense at all).
- `TimeWindow`/`TimeFrame` stream - like exisitng `WindowStream`, but window would by defined by time not amount of chunks. For example, chunks from the last hour (based on system time?). Could be useful for generating real time statistics.

### Creators

More creators (`.from*()`):

- Creating streams from EventEmitters (e.g. websocket, httpServer, etc), seems like a super-useful shortcut for devs. Since each event emitter can have different event names it would require something like `.from<T>(input: EventEmitter, dataEventName: String, closeEventName?: String, errorEventName?: String)`.
- Creating streams directly from URIs (thinking mostly about HTTP) - not sure what it should return (a string, buffer), but could be useful for scraping maybe?
