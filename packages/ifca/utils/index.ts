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
function trace (msg:string, array: any[]|null = null) {
    if (!process.env.SCRAMJET_LOG) return;

    const date = new Date();

    console.log(`${date.valueOf()}: ${msg}`);
    if (array) {
        for (let i = 0; i < array.length; i++) {
            console.log(array[i]);
        }
        console.log('Length: ' + array.length);
    }
    console.log();
}

export { defer, trace } ;