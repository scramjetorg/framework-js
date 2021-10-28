import test from "ava";
import { HTMLStream } from "../../../src/streams/html-stream";

test("HTMLStream can do magic", async (t) => {
    function * urls() {
        for (let i = 1; i < 6; i++) {
            yield `https://news.ycombinator.com/news?p=${i}`;
        }
    }

    const stream = HTMLStream.from(urls()) as HTMLStream<string>;
    const result = await stream
        .log()
        .fetch()
        .asDOM() //should be done underneath
        .query("tr.athing")
        .map((element) => ({
            title: element.querySelector("td.title > a").textContent,
            href: element.querySelector("td.title > a").getAttribute("href"),
            rank: parseInt(element.querySelector("span.rank").textContent, 10),
            // score: parseInt(element.nextElementSibling.querySelector('span.score').textContent, 10),
        })) // fetch meta data from each page
        .toArray();

    console.log(result);

    t.pass();
});
