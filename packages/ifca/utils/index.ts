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

export { defer} ;