const {dirname, resolve} = require("path");

/** @ignore */
const getCalleeDirname = function(depth) {
    const p = Error.prepareStackTrace;
    Error.prepareStackTrace = (dummy, stack) => stack;
    const e = new Error();
    Error.captureStackTrace(e, arguments.callee);
    const stack = e.stack;
    Error.prepareStackTrace = p;
    return dirname(stack[depth].getFileName());
};

const resolveCalleeRelative = function(depth, ...relatives) {
    return resolve(getCalleeDirname(depth + 1), ...relatives);
};

/** @ignore */
const resolveCalleeBlackboxed = function() {
    const p = Error.prepareStackTrace;
    Error.prepareStackTrace = (dummy, stack) => stack;
    const e = new Error();
    Error.captureStackTrace(e, arguments.callee);
    const stack = e.stack;
    Error.prepareStackTrace = p;

    let pos = stack.find(entry => entry.getFileName().indexOf(resolve(__dirname, "..")) === -1);

    return resolve(dirname(pos.getFileName()), ...arguments);
};

/**
 * @external AsyncGeneratorFunction
 */
let AsyncGeneratorFunction = function() {};
try {
    AsyncGeneratorFunction = require("./async-generator-constructor");
} catch (e) {} // eslint-disable-line

/**
 * @external GeneratorFunction
 */
const GeneratorFunction = Object.getPrototypeOf(function*(){}).constructor;

/** @ignore */
const pipeIfTarget = (stream, target) => (target ? stream.pipe(target) : stream);

/** @ignore */
const pipeThen = async (func, target) => Promise
    .resolve()
    .then(func)
    .then(x => x.pipe(target))
    .catch(e => target.raise(e));

/**
 * @external stream.PassThrough
 * @see https://nodejs.org/api/stream.html#stream_class_stream_passthrough
 */

module.exports = {
    AsyncGeneratorFunction,
    GeneratorFunction,
    getCalleeDirname,
    resolveCalleeRelative,
    resolveCalleeBlackboxed,
    pipeIfTarget,
    pipeThen
};
