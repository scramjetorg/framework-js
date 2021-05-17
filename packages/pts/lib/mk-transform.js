const ignore = () => 0;
const { StreamError } = require("./stream-errors");


/**
 * Generate transform methods on the stream class.
 *
 * @internal
 * @memberof PromiseTransformStream
 * @param  {DataStreamOptions} newOptions Sanitized options passed to scramjet stream
 * @return {Boolean} returns true if creation of new stream is not necessary (promise can be pushed to queue)
 */
module.exports = ({filter}) => function mkTransform(newOptions) {
    this.setOptions(
        {
            transforms: [],
            beforeTransform: newOptions.beforeTransform,
            afterTransform: newOptions.afterTransform,
            promiseFlush: newOptions.promiseFlush
        }
    );

    this.cork();
    if (newOptions.referrer instanceof this.constructor && !newOptions.referrer._tapped && !newOptions.referrer._options.promiseFlush) {
        return true;
    }

    process.nextTick(this.uncork.bind(this));

    this.pushTransform(newOptions);

    if (this._scramjet_options.transforms.length) {

        const processing = [];
        let last = Promise.resolve();

        this._transform = (chunk, encoding, callback) => {
            if (!this._scramjet_options.transforms.length) {
                return last.then(
                    () => callback(null, chunk)
                );
            }

            const prev = last;
            const ref = last = Promise
                .all([
                    this._scramjet_options.transforms.reduce(
                        (prev, transform) => prev.then(transform),
                        Promise.resolve(chunk)
                    ).catch(
                        (err) => err === filter ? filter : Promise.reject(err)
                    ),
                    prev
                ])
                .catch(
                    async (e) => {
                        if (e instanceof Error) {
                            return Promise.all([
                                this.raise(new StreamError(e, this, "EXTERNAL", chunk), chunk),
                                prev
                            ]);
                        } else {
                            throw new Error("New stream error raised without cause!");
                        }
                    }
                )
                .then(
                    (args) => {
                        if (args && args[0] !== filter && typeof args[0] !== "undefined") {
                            try {
                                this.push(args[0]);
                            } catch(e) {
                                return this.raise(new StreamError(e, this, "INTERNAL", chunk), chunk);
                            }
                        }
                    }
                );

            processing.push(ref);   // append item to queue
            if (processing.length >= this._options.maxParallel) {
                processing[processing.length - this._options.maxParallel]
                    .then(() => callback())
                    .catch(ignore);
            } else {
                callback();
            }

            ref.then(
                () => {
                    const next = processing.shift();
                    return ref !== next && this.raise(new StreamError(new Error(`Promise resolved out of sequence in ${this.name}!`), this, "TRANSFORM_OUT_OF_SEQ", chunk), chunk);
                }
            );

        };

        this._flush = (callback) => {
            if (this._scramjet_options.runFlush) {
                last
                    .then(this._scramjet_options.runFlush)
                    .then(
                        (data) => {
                            if (Array.isArray(data))
                                data.forEach(item => this.push(item));
                            else if (data)
                                this.push(data);
                        },
                        e => this.raise(e)
                    )
                    .then(() => callback());
            } else {
                last.then(() => callback());
            }
        };
    }
};
