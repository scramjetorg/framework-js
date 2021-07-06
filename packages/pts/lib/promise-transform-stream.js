const {Transform, Readable} = require("stream");
const {EventEmitter} = require("events");
const DefaultHighWaterMark = require("os").cpus().length * 2;

const filter = Symbol("FILTER");
const plgctor = Symbol("plgctor");
const storector = Symbol("storector");

let seq = 0;

const shared = { filter, DefaultHighWaterMark, plgctor, storector };
const mkTransform = require("./mk-transform")(shared);
const mkRead = require("./mk-read")(shared);
const mkWrite = require("./mk-write")(shared);
const {StreamError} = require("./stream-errors");

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

    if (["promiseRead", "promiseWrite", "promiseTransform"].reduce((acc, key) => acc += (options[key] ? 1 : 0), 0) > 1)
        throw new Error("Scramjet stream can be either Read, Write or Transform");
};

/**
 * This class is an underlying class for all Scramjet streams.
 *
 * It allows creation of simple transform streams that use async functions for transforms, reading or writing.
 *
 * @internal
 * @extends stream.PassThrough
 */
class PromiseTransformStream extends Transform {

    constructor(options) {
        options = options || {};
        const newOptions = Object.assign({
            objectMode: true,
            promiseRead: null,
            promiseWrite: null,
            promiseTransform: null,
            promiseFlush: null,
            beforeTransform: null,
            afterTransform: null
        }, options);

        checkOptions(newOptions);

        super(newOptions);

        this._tapped = false;

        this._error_handlers = [];
        this._scramjet_options = {
            referrer: options.referrer,
            constructed: (new Error().stack)
        };

        this.seq = seq++;

        this.setMaxListeners(DefaultHighWaterMark);
        this.setOptions(newOptions);

        if (newOptions.promiseRead) {
            this.type = "Read";
            mkRead.call(this, newOptions);
            this.tap();
        } else if (newOptions.promiseWrite) {
            this.type = "Write";
            mkWrite.call(this, newOptions);
        } else if (newOptions.transform || !newOptions.promiseTransform) {
            this.type = "Transform-";
            this.tap();
        } else {
            this.type = "Transform";
            if (newOptions.promiseTransform && mkTransform.call(this, newOptions)) { // returns true if transform can be pushed to referring stream
                return options.referrer.pushTransform(options);
            }
        }

        const pluginConstructors = this.constructor[plgctor].get();
        if (pluginConstructors.length) {

            let ret;
            pluginConstructors.find(
                (Ctor) => ret = Ctor.call(this, options)
            );

            if (typeof ret !== "undefined") {
                return ret;
            }
        }
    }

    get name() {
        return `${this.constructor.name}(${this._options.name || this.seq})`;
    }

    set name(name) {
        this.setOptions({name});
    }

    get constructed() {
        return this._scramjet_options.constructed;
    }

    get _options() {
        if (this._scramjet_options.referrer && this._scramjet_options.referrer !== this) {
            return Object.assign({maxParallel: DefaultHighWaterMark}, this._scramjet_options.referrer._options, this._scramjet_options);
        }
        return Object.assign({maxParallel: DefaultHighWaterMark}, this._scramjet_options);
    }

    setOptions(...options) {
        Object.assign(this._scramjet_options, ...options);

        if (this._scramjet_options.maxParallel)
            this.setMaxListeners(this._scramjet_options.maxParallel);

        if (this._flushed) {
            options.forEach(
                ({promiseFlush}) => Promise
                    .resolve()
                    .then(promiseFlush)
                    .catch(e => this.raise(e))
            );
        }

        return this;
    }

    setMaxListeners(value) {
        return super.setMaxListeners.call(this, value + EventEmitter.defaultMaxListeners);
    }

    static get [plgctor]() {
        const proto = Object.getPrototypeOf(this);
        return {
            ctors: this[storector] = Object.prototype.hasOwnProperty.call(this, storector) ? this[storector] : [],
            get: () => proto[plgctor] ? proto[plgctor].get().concat(this[storector]) : this[storector]
        };
    }

    async whenRead(count) {
        return Promise.race([
            new Promise((res) => {

                const read = () => {
                    const ret = this.read(count);
                    if (ret !== null) {
                        return res(ret);
                    } else {
                        this.once("readable", read);
                    }
                };
                read();
            }),
            this.whenError(),
            this.whenEnd()
        ]);
    }

    async whenDrained() {
        return this._scramjet_drainPromise || (this._scramjet_drainPromise = new Promise(
            (res, rej) => this
                .once("drain", () => {
                    this._scramjet_drainPromise = null;
                    res();
                })
                .whenError().then(rej)
        ));
    }

    async whenWrote(...data) {
        let ret;
        for (var item of data)
            ret = this.write(item);

        if (ret) {
            return;
        } else {
            return this.whenDrained();
        }
    }

    async whenError() {
        return this._scramjet_errPromise || (this._scramjet_errPromise = new Promise((res) => {
            this.once("error", (e) => {
                this._scramjet_errPromise = null;
                res(e);
            });
        }));
    }

    async whenEnd() {
        return this._scramjet_endPromise || (this._scramjet_endPromise = new Promise((res, rej) => {
            this.whenError().then(rej);
            this.on("end", () => res());
        }));
    }

    async whenFinished() {
        return this._scramjet_finishPromise || (this._scramjet_finishPromise = new Promise((res, rej) => {
            this.whenError().then(rej);
            this.on("finish", () => res());
        }));
    }

    catch(callback) {
        this._error_handlers.push(callback);
        return this;
    }

    async raise(err, ...args) {
        return this._error_handlers
            .reduce(
                (promise, handler) => promise.catch(
                    (lastError) => handler(
                        lastError instanceof StreamError
                            ? lastError
                            : new StreamError(lastError, this, err.code, err.chunk),
                        ...args
                    )
                ),
                Promise.reject(err)
            )
            .catch(
                (err) => this.emit("error", err, ...args)
            );
    }

    pipe(to, options) {
        if (to === this) {
            return this;
        }

        if (this !== to && to instanceof PromiseTransformStream) {
            to.setOptions({referrer: this});
            this.on("error", err => to.raise(err));
            this.tap().catch(async (err, ...args) => {
                await to.raise(err, ...args);
                return filter;
            });
        } else if (to instanceof Readable) {
            this.on("error", (...err) => to.emit("error", ...err));
        }

        return super.pipe(to, options || {end: true});
    }

    graph(func) {
        let referrer = this;
        const ret = [];
        while(referrer) {
            ret.push(referrer);
            referrer = referrer._options.referrer;
        }
        func(ret);
        return this;
    }

    tap() {
        this._tapped = true;
        return this;
    }

    dropTransform(transform) {
        if (!this._scramjet_options.transforms) {
            if (!this._transform.currentTransform)
                return this;

            this._transform = this._transform.currentTransform;
            return this;
        }
        let i = 0;
        while (i++ < 1000) {
            const x = this._scramjet_options.transforms.findIndex(t => t.ref === transform);
            if (x > -1) {
                this._scramjet_options.transforms.splice(x, 1);
            } else {
                return this;
            }
        }
        throw new Error("Maximum remove attempt count reached!");
    }

    pushTransform(options) {

        if (typeof options.promiseTransform === "function") {
            if (!this._scramjet_options.transforms) {
                this._pushedTransform = options.promiseTransform;
                return this;
            }

            const markTransform = (bound) => {
                bound.ref = options.promiseTransform;
                return bound;
            };

            const before = typeof options.beforeTransform === "function";
            const after = typeof options.afterTransform === "function";

            if (before)
                this._scramjet_options.transforms.push(markTransform(
                    options.beforeTransform.bind(this)
                ));

            if (after)
                this._scramjet_options.transforms.push(markTransform(
                    async (chunk) => options.afterTransform.call(
                        this,
                        chunk,
                        await options.promiseTransform.call(this, chunk)
                    )
                ));
            else
                this._scramjet_options.transforms.push(markTransform(
                    options.promiseTransform.bind(this)
                ));

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

    _selfInstance(...args) {
        return new this.constructor(...args);
    }

    async _transform(chunk, encoding, callback) {
        if (!this._delayed_first) {
            await new Promise(res => res());
            this._delayed_first = 1;
        }

        try {
            if (this._pushedTransform)
                chunk = await this._pushedTransform(chunk);
            callback(null, chunk);
        } catch(err) {
            callback(err);
        }
    }

    _flush(callback) {
        const last = Promise.resolve();

        if (this._scramjet_options.runFlush) {
            last
                .then(this._scramjet_options.runFlush)
                .then(
                    (data) => {
                        if (Array.isArray(data))
                            data.forEach(item => this.push(item));
                        else if (data)
                            this.push(data);

                        callback();
                    },
                    e => this.raise(e)
                );
        } else {
            last.then(() => callback());
        }
    }

    static get filter() { return filter; }
}

module.exports = {
    plgctor: plgctor,
    PromiseTransformStream
};
