"use strict";

const { Transform /* Readable */ } = require("stream");
// const { EventEmitter } = require("events");
const DefaultHighWaterMark = require("os").cpus().length * 2;
const { IFCA } = require("../../ifca/lib/ifca");

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

class PromiseTransformStream extends Transform {
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
        console.log("NEW OPTIONS BEFORE IF:");
        console.log(newOptions);

        // IFCA
        this.ifca = new IFCA(newOptions.maxParallel, newOptions.promiseTransform);

        if (newOptions.promiseRead) {
            this.type = "Read";
            // mkRead.call(this, newOptions);
            this.ifca.read();
            this.tap();
        } else if (newOptions.promiseWrite) {
            this.type = "Write";
            // mkWrite.call(this, newOptions);
            this.ifca.write();
        } else if (newOptions.transform || !newOptions.promiseTransform) {
            this.type = "Transform-"; // ???????
            this.tap();
        } else {
            this.type = "Transform";
            console.log("TRANSFORM...");
            // It's always false
            // if (newOptions.promiseTransform && mkTransform.call(this, newOptions)) {
            // if (newOptions.promiseTransform && this.ifca.addTransform(newOptions.promiseTransform)) {
            //     // returns true if transform can be pushed to referring stream
            //     console.log("RETURN AND PUSH TRANSFORM"); // Never executed
            //     return options.referrer.pushTransform(options);
            // }
            this.ifca.addTransform(newOptions.promiseTransform);
        }
        // What's this?
        // const pluginConstructors = this.constructor[plgctor].get();
        // if (pluginConstructors.length) {
        //     let ret;
        //     pluginConstructors.find((Ctor) => (ret = Ctor.call(this, options)));

        //     if (typeof ret !== "undefined") {
        //         return ret;
        //     }
        // }

        this.addListener("data", (chunk) => {
            console.log("LISTNER1 data chunk: " + chunk); // Why his is [object Promises]
            this.ifca.write(chunk);
        });
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
        console.log("PTS.pushTransform... options:");
        console.log(options);
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

    async _transform(chunk, encoding, callback) {
        console.log("PTS-IFCA _transform chunk: " + JSON.stringify(chunk));
        this.ifca.write(chunk);
        callback();
    }

    _flush(callback) {
        console.log("PTS-IFCA FLUSH");
        this.ifca.end();
        callback();
    }

    async _write(data) {
        console.log("PTS-IFCA WRITE data:" + JSON.stringify(data));
        this.ifca.write(data);
    }

    // This happens to early! Why!? Before the first write there are almost 20 reads....
    /**
     *
     * @param {integer} size
     */
    async _read(size) {
        console.log("PTS-IFCA _read size: " + size);

        const result = this.ifca.read(); // result is Promise { <pending> }
        console.log("PTS.read result:");
        // console.log(result);

        const resolved = Promise.all([result]);
        this.push(resolved);
        // result.then((value) => {
        //     console.log("read result then value: " + value);
        // });
    }
}

module.exports = {
    PromiseTransformStream,
};
