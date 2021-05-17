const { StreamError } = require("./stream-errors");

/**
 * Generate write methods on the stream class.
 *
 * @internal
 * @param  {DataStreamOptions} newOptions Sanitized options passed to scramjet stream
 * @return {Boolean} returns true if creation of new stream is not necessary (promise can be pushed to queue)
 */
module.exports = () => function mkWrite(newOptions) {
    this.tap().setOptions(
        {
            // transforms: [],
            promiseWrite: newOptions.promiseWrite
        }
    );

    this.pipe = () => {
        throw new Error("Method not allowed on a Writable only stream");
    };

    this._write = (chunk, encoding, callback) => {
        Promise.resolve(chunk)
            .then((chunk) => this._options.promiseWrite(chunk, encoding))
            .then(() => callback())
            .catch(
                (e) => this.raise(new StreamError(e, this, "EXTERNAL", chunk), chunk)
            );
    };

};
