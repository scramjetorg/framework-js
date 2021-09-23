const SCRAMJET_LOG = process.env.SCRAMJET_LOG;

/**
 * Helper function that defers and optionaly returns given output after waiting.
 *
 * @param {number} ts Number of milliseconds to wait
 * @param {Object} [out] Optional output
 * @returns {Promise}
 */
function defer<X extends any | undefined>(ts: number, out?: X): Promise<X | void> {
    return new Promise((res) => setTimeout(() => res(out), ts));
}

/**
 * Helper function that prints out debug messages
 *
 * @param {String} msg Debug message to be printed out
 * @param {*} [array] Optional array of objects
 */
function trace (msg:any, ...array: any[]) {
    // TODO: make this into a const false on compile
    if (!SCRAMJET_LOG) return;

    const date = new Date();

    console.log(`${date.valueOf()}: ${msg}`, ...array);
}

export { defer, trace };
