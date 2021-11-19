import test from "ava";
import { StringStream } from "../../../../src/streams/string-stream";

test("Match returns only matched parts of each chunk (no regexp group)", async (t) => {
    const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et\n" +
        "dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea\n" +
        "commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla\n" +
        "pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est\n" +
        "laborum.";
    const words4 = await StringStream.from([text])
        .match(/\b\w{4}[^\w]/g)
        .toArray();

    t.deepEqual(words4, ["amet,", "elit,", "enim ", "quis ", "nisi ", "Duis ", "aute ", "esse ", "sint ", "sunt ", "anim "]);
});

test("Match returns only matched parts of each chunk (single regexp group)", async (t) => {
    const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et\n" +
        "dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea\n" +
        "commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla\n" +
        "pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est\n" +
        "laborum.";
    const words4 = await StringStream.from([text])
        .match(/\b(\w{4})[^\w]/g)
        .toArray();

    t.deepEqual(words4, ["amet", "elit", "enim", "quis", "nisi", "Duis", "aute", "esse", "sint", "sunt", "anim"]);
});

test("Match returns only matched parts of each chunk (multiple regexp groups)", async (t) => {
    const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et\n" +
        "dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea\n" +
        "commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla\n" +
        "pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est\n" +
        "laborum.";
    const words4 = await StringStream.from([text])
        .match(/\b(\w{2})(\w{2})[^\w]/g)
        .toArray();

    t.deepEqual(words4, [
        "am", "et", "el", "it", "en", "im", "qu", "is", "ni", "si", "Du", "is", "au", "te", "es", "se", "si", "nt", "su", "nt", "an", "im"
    ]);
});
