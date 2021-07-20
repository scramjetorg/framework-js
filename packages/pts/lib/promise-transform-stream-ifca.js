"use strict";

const { Duplex } = require("stream");
const DefaultHighWaterMark = require("os").cpus().length * 2;
const { IFCA } = require("../../ifca/lib/index");
const { trace } = require("../../ifca/utils");

let seq = 0;

const rename = (ob, fr, to) => {
    if (ob[fr]) {
        ob[to] = ob[fr];
        delete ob[fr];
    }
};

const checkOptions = (options) => {
    rename(options, "parallelRead", "promiseRead");
    rename(options, "parallelWrite", "promiseWrite");
    rename(options, "parallelTransform", "promiseTransform");
    rename(options, "flushPromise", "promiseFlush");

    if (["promiseRead", "promiseWrite", "promiseTransform"].reduce((acc, key) => (acc += options[key] ? 1 : 0), 0) > 1)
        throw new Error("Scramjet stream can be either Read, Write or Transform");
};

class PromiseTransformStream extends Duplex {
    constructor(options = {}) {
        const newOptions = Object.assign(
            {
                objectMode: true,
                promiseRead: null,
                promiseWrite: null,
                promiseTransform: null,
                promiseFlush: null,
                beforeTransform: null,
                afterTransform: null,
            },
            options
        );
        checkOptions(newOptions);

        super(newOptions);

        this._tapped = false;

        this._error_handlers = [];
        this._scramjet_options = {
            referrer: options.referrer,
            constructed: new Error().stack,
        };

        this.seq = seq++;

        this.setMaxListeners(DefaultHighWaterMark);
        this.setOptions(newOptions);
        trace("NEW OPTIONS BEFORE IF:");
        trace(newOptions);

        // IFCA
        this.ifca = new IFCA(newOptions.maxParallel, newOptions.promiseTransform);
    }

    setOptions(...options) {
        Object.assign(this._scramjet_options, ...options);

        if (this._scramjet_options.maxParallel) this.setMaxListeners(this._scramjet_options.maxParallel);

        if (this._flushed) {
            options.forEach(({ promiseFlush }) =>
                Promise.resolve()
                    .then(promiseFlush)
                    .catch((e) => this.raise(e))
            );
        }

        return this;
    }

    pushTransform(options) {
        trace("PTS.pushTransform... options:");
        trace(options);
        if (typeof options.promiseTransform === "function") {
            this.ifca.addTransform(options.promiseTransform);
        }

        if (typeof options.promiseFlush === "function") {
            if (this._scramjet_options.runFlush) {
                throw new Error("Promised Flush cannot be overwritten!");
            } else {
                this._scramjet_options.runFlush = options.promiseFlush;
            }
        }

        return this;
    }

    addTransform(transform) {
        return this.ifca.addTransform(transform);
    }

    addHandler(handler) {
        console.log(handler);
        return this.ifca.addErrorHandler(handler);
    }

    async _final(callback) {
        trace("PTS-IFCA FINAL");
        await this.ifca.end();
        callback();
    }

    async _write(data, encoding, callback) {
        trace("PTS-IFCA WRITE data:" + JSON.stringify(data));
        await this.ifca.write(data);
        callback();
    }

    /**
     * https://nodejs.org/api/stream.html#stream_writable_writev_chunks_callback
     *
     * @param {Object[]} chunks
     * @param {Function} callback
     */
    async _writev(chunks, callback) {
        trace("WRITEV chunks: " + JSON.stringify(chunks));

        await this.ifca.writev(chunks.map((o) => o.chunk));
        callback();
    }

    /**
     *
     * @param {integer} size
     */
    async _read(size) {
        trace("PTS-IFCA _read size: " + size);

        const result = await this.ifca.read();
        trace("PTS.read result: " + JSON.stringify(result));
        this.push(result);
    }
}

module.exports = {
    PromiseTransformStream,
};
