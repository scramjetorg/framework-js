const ignore = () => 0;
const { StreamError } = require("./stream-errors");

const { trace } = require("../../../src/utils");

/**
 * Generate transform methods on the stream class.
 *
 * @internal
 * @memberof PromiseTransformStream
 * @param  {DataStreamOptions} newOptions Sanitized options passed to scramjet stream
 * @return {Boolean} returns true if creation of new stream is not necessary (promise can be pushed to queue)
 */
module.exports = ({ filter }) =>
    function mkTransform(newOptions) {
        trace("mkTransform called!");
        trace(newOptions);
        this.setOptions({
            transforms: [],
            beforeTransform: newOptions.beforeTransform,
            afterTransform: newOptions.afterTransform,
            promiseFlush: newOptions.promiseFlush,
        });

        this.cork(); // https://nodejs.org/api/stream.html#stream_writable_cork
        if (
            newOptions.referrer instanceof this.constructor &&
            !newOptions.referrer._tapped &&
            !newOptions.referrer._options.promiseFlush
        ) {
            return true;
        }
        trace("mkTransform DONT RETURN TRUE");

        process.nextTick(this.uncork.bind(this)); // https://nodejs.org/api/stream.html#stream_writable_uncork
        trace(
            "mkTransform this.pushTransform. before: this._scramjet_options.transforms.length: " +
                this._scramjet_options.transforms.length
        );
        this.pushTransform(newOptions);
        trace("after push this._scramjet_options.transforms.length: " + this._scramjet_options.transforms.length);

        if (this._scramjet_options.transforms.length) {
            const processing = [];
            let last = Promise.resolve(); // Promise { undefined }

            trace("TRANSFORMS LENGTH > 0. LAST:");
            trace(last);

            /**
             * https://nodejs.org/api/stream.html#stream_transform_transform_chunk_encoding_callback
             * @param {*} chunk Chunk to be processed
             * @param {*} encoding Encoding not used
             * @param {*} callback Callback
             * @returns
             */
            this._transform = (chunk, encoding, callback) => {
                trace(
                    "TRANSFORM this._transform  chunk: " +
                        JSON.stringify(chunk) +
                        " length: " +
                        this._scramjet_options.transforms.length
                );
                if (!this._scramjet_options.transforms.length) {
                    return last.then(() => callback(null, chunk));
                }

                const prev = last;
                const ref = (last = Promise.all([
                    this._scramjet_options.transforms
                        .reduce((prev, transform) => prev.then(transform), Promise.resolve(chunk))
                        .catch((err) => (err === filter ? filter : Promise.reject(err))),
                    prev,
                ])
                    .catch(async (e) => {
                        if (e instanceof Error) {
                            return Promise.all([this.raise(new StreamError(e, this, "EXTERNAL", chunk), chunk), prev]);
                        } else {
                            throw new Error("New stream error raised without cause!");
                        }
                    })
                    .then((args) => {
                        if (args && args[0] !== filter && typeof args[0] !== "undefined") {
                            try {
                                this.push(args[0]);
                            } catch (e) {
                                return this.raise(new StreamError(e, this, "INTERNAL", chunk), chunk);
                            }
                        }
                    }));

                trace("PROCESSING BEFORE PUSH:");
                trace(
                    "processing.length >= this._options.maxParallel: " +
                        (processing.length >= this._options.maxParallel)
                );
                processing.push(ref); // append item to queue
                if (processing.length >= this._options.maxParallel) {
                    processing[processing.length - this._options.maxParallel].then(() => callback()).catch(ignore);
                } else {
                    trace("EXECUTE CALLBACK...");
                    callback();
                }

                trace("PROCESSING AFTER PUSH:");
                trace(processing);

                ref.then(() => {
                    trace("THEN...");
                    trace(processing);
                    const next = processing.shift(); // Take out the first element from processing obviously

                    trace("NEXT: ");
                    trace(next);
                    trace(JSON.stringify(next));

                    const result =
                        ref !== next &&
                        this.raise(
                            new StreamError(
                                new Error(`Promise resolved out of sequence in ${this.name}!`),
                                this,
                                "TRANSFORM_OUT_OF_SEQ",
                                chunk
                            ),
                            chunk
                        );
                    trace("RESULT: " + result);
                    return result;
                });
            };

            this._flush = (callback) => {
                trace("FLUSH");
                if (this._scramjet_options.runFlush) {
                    last.then(this._scramjet_options.runFlush)
                        .then(
                            (data) => {
                                if (Array.isArray(data)) data.forEach((item) => this.push(item));
                                else if (data) this.push(data);
                            },
                            (e) => this.raise(e)
                        )
                        .then(() => callback());
                } else {
                    last.then(() => callback());
                }
            };
        }
    };
