// This code will not run since it's a sample showing how it may look in Scramjet Framewrok v5.

const fs = require('fs');
const { StringStream } = require('scramjet');

StringStream
	.from(fs.createReadStream('vgsales.csv', 'utf8'))
	.setOptions({maxParallel: 100})
	.lines()
	.parse<Object>(line => {
		const [rank, name, platform, year, genre, publisher] = line.split(',');
		return {rank, name, platform, year, genre, publisher};
	}) // here we are transforming from StringStream to DataStream<Object>
	.filter(record => record.publisher === 'Nintendo')
	.stringify(record => Object.values( record ).join(',')) // here we are transforming back from DataStream<Object> to StringStream
	.append("\n")
	.catch(err => `! Error occured ${err}`)
	.pipe(fs.createWriteStream('vgsales-nintendo-ts-1.csv'));

// Simpler version
DataStream
    .from<String>(fs.createReadStream('vgsales.csv', 'utf8'))
    .setOptions({maxParallel: 100})
    .split('\n') // I assumed here DataStream will provide split method (to show more generic calls with DataStream)
    .map<Object>(line => {
        const [rank, name, platform, year, genre, publisher] = line.split(',');
        return {rank, name, platform, year, genre, publisher};
    }) // here we are transforming from DataStream<String> to DataStream<Object>
    .filter(record => record.publisher === 'Nintendo')
    .map<String>(record => Object.values( record ).join(','))  // here we are transforming back from DataStream<Object> to DataStream<String>
    .map<String>(record => record + '\n')
    .catch(err => `! Error occured ${err}`)
    .pipe(fs.createWriteStream('vgsales-nintendo-ts-2.csv'));
