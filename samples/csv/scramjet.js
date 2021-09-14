const fs = require('fs');
const { StringStream } = require('scramjet');

StringStream
	.from(fs.createReadStream('vgsales.csv', 'utf8'))
	.setOptions({maxParallel: 100})
	.lines()
	.parse(line => {
		const [rank, name, platform, year, genre, publisher] = line.split(',');
		return {rank, name, platform, year, genre, publisher};
	})
	.filter(record => record.publisher === 'Nintendo')
	.stringify(record => Object.values( record ).join(','))
	.append("\n")
	.catch(err => `! Error occured ${err}`)
	.pipe(fs.createWriteStream('vgsales-nintendo-sj.csv'));
