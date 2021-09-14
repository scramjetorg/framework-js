const fs = require('fs');
const util = require('util');
const stream = require('stream');
const pipeline = util.promisify(stream.pipeline);

async function run() {
	await pipeline(
		fs.createReadStream('vgsales.csv', 'utf8'),
		async function* (source) {
			// split into lines
			// chunk is a part of file of a given length, it may end in the middle
			// of the line which will cause incomplete records - this requires additional manual handling here
			// btw. there is also readline node module: https://nodejs.org/api/readline.html
			for await (const chunk of source) {
				// console.log(chunk);

				const lines = chunk.split( '\n' );
				for (const line of lines) {
					yield line;
				}
			}
		},
		async function* (lines) {
			// map lines to records
			for await (const line of lines) {
				// console.log(line);

				const values = line.split(',');

				yield {
					rank: values[0],
					name: values[1],
					platform: values[2],
					year: values[3],
					genre: values[4],
					publisher: values[5]
				};
			}
		},
		async function* (records) {
			// filter - get games by Nintendo only
			for await(const record of records) {
				// console.log(record);

				if ( record.publisher === 'Nintendo' ) {
					yield record;
				}
			}
		},
		async function* (records) {
			// stringify back to csv
			for await (const record of records) {
				// console.log( record );

				yield Object.values( record ).join(',') + '\n';
			}
		},
		fs.createWriteStream('vgsales-nintendo-ns.csv')
	);
	console.log('Pipeline succeeded.');
}

run().catch(console.error);

// TODO?
// create multiple csv's based on publisher (requires stream duplication AFAIU)
// create summary (and write to another file) for each publisher (again stream duplication?)
