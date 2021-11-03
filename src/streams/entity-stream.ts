import { DataStream } from "./data-stream";
const { JSDOM } = require("jsdom");
const axios = require("axios").default;

// Should be resource stream
export type Entity = { url: string, data?: any }; // data, document response

export class EntityStream extends DataStream<Entity> {

    // log( prefix )
    log(): this {
        this.map(chunk => { console.log(chunk); return chunk; });

        return this;
    }

    // fetch( urlPath, saveAsPath )
    fetch(): EntityStream {
        const fetcher = async (chunk: Entity): Promise<Entity> => {
            chunk.data = (await axios.get(chunk.url)).data; // chunk[saveAsPath] = ...

            return chunk;
        };

        return this.map(fetcher) as EntityStream;
    }

    // TBD
    query(selector: string): EntityStream {
        const query = (chunk): Entity[] => {
            const document = this.getDOM(chunk.data);

            return Array.from(document.querySelectorAll(selector));
        };

        return this.flatMap(query) as EntityStream;
    }

    private getDOM(html: string): any {
        return (new JSDOM(html)).window;
    }
}
