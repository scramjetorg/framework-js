import { DataStream } from "./data-stream";
const { JSDOM } = require("jsdom");
const axios = require("axios").default;

export class HTMLStream<T> extends DataStream<T> {

    log(): this {
        this.map(chunk => { console.log(chunk); return chunk; });

        return this;
    }

    fetch(): HTMLStream<string> {
        const fetcher = async (chunk: T): Promise<string> => {
            const response = await axios.get(chunk);

            return response.data as string;
        };

        return this.map(fetcher) as HTMLStream<string>;
    }

    asDOM(): HTMLStream<any> {
        const toDOM = (chunk: T): any => {
            const { document } = (new JSDOM(chunk)).window;

            return document;
        };

        return this.map(toDOM) as HTMLStream<any>;
    }

    query(selector: string): HTMLStream<any> {
        const query = (chunk: T): any[] => {
            return Array.from((chunk as any).querySelectorAll(selector));
        };

        return this.flatMap(query) as HTMLStream<any>;
    }
}
