const { StreamError } = require("./stream-errors");

/**
 * Generate read methods on the stream class.
 *
 * @internal
 * @param  {DataStreamOptions} newOptions Sanitized options passed to scramjet stream
 * @return {Boolean} returns true if creation of new stream is not necessary (promise can be pushed to queue)
 */
module.exports = () => function mkRead(newOptions) {
    this.setOptions(
        {
            // transforms: [],
            promiseRead: newOptions.promiseRead
        }
    );

    let chunks = [];
    let done = false;
    // TODO: implement the actual parallel logic - items can be promises and should be flushed when resolved.
    const pushSome = () => Array.prototype.findIndex.call(chunks, chunk => {
        return !this.push(chunk);
    }) + 1;

    // let last = Promise.resolve();
    // let processing = [];

    this.on("pipe", () => {
        throw new Error("Cannot pipe to a Readable stream");
    });

    this._read = async (size) => {
        try {
            let add = 0;
            if (!done) {
                const nw = await this._options.promiseRead(size);
                chunks.push(...nw);
                add = nw.length;
            }
            const pushed = pushSome();
            chunks = chunks.slice(pushed || Infinity);

            // Yes, it could be reassigned, but only with true so we don't need to care
            // eslint-disable-next-line require-atomic-updates
            done = done || !add;

            if (done && !chunks.length) {
                await new Promise((res, rej) => this._flush((err) => err ? rej(err) : res()));
                this.push(null);
            }

            // console.log("read", pushed, chunks, add, size);
            // TODO: check for existence of transforms and push to transform directly.
            // TODO: but in both cases transform methods must be there... which aren't there now.
            // TODO: at least the subset that makes the transform - yes, otherwise all that transform stuff
            // TODO: is useless and can be bypassed...
        } catch(e) {
            await this.raise(new StreamError(e, this));
            return this._read(size);
        }
    };

};
