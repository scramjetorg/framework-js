import { Server } from 'ws';
import { uniqueNamesGenerator, Config, names, adjectives, colors } from 'unique-names-generator';

const namesConfig: Config = {
	dictionaries: [names, adjectives, colors],
	separator: ' ',
	length: 3,
};

const wss = new Server( { port: 8080 } );

console.log( 'WS server up!' );

wss.on('connection', (ws) => {

	console.log( 'Client connected...' );

	ws.on('message', async (message) => {
		const nr = parseInt( message.toString() );
		const namesGenerator = getNames( nr );

		for await (const name of namesGenerator) {
			ws.send(name);
		}

		ws.close();
	});
});

async function* getNames( length: Number ) {
	for (let i = 0; i < length; i++) {
		yield await getName();
	}
}

async function getName() {
	return new Promise(res => {
		setTimeout(() => {
			res(uniqueNamesGenerator(namesConfig));
		}, 500);
	});
}
