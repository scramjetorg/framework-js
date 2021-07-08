"use strict";

const { Transform /* Readable */ } = require("stream");
// const { EventEmitter } = require("events");
const { IFCA } = require("../../ifca/lib/ifca");

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
            if (newOptions.promiseTransform && this.ifca.addTransform(newOptions.promiseTransform)) {
                // returns true if transform can be pushed to referring stream
                console.log("RETURN AND PUSH TRANSFORM"); // Never executed
                return options.referrer.pushTransform(options);
            }
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
    }

    async _transform(chunk, encoding, callback) {}

    _flush(callback) {}
}

module.exports = {
    PromiseTransformStream,
};
