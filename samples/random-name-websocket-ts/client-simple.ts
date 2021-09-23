import WebSocket = require('ws');

const namesNr = process.argv[2] || '10';
const ws = new WebSocket('ws://127.0.0.1:8080');

let counter = 1;

console.log( 'Connected to WS server!' );

ws.on('open', () => {
	console.log(`Requesting ${ namesNr } random names...`);

	ws.send(namesNr);
});

ws.on('message', (message) => {
	console.log(`${ counter }. ${ message }`);
	counter++;
});

ws.on('close', () => {
	console.log('Connection closed by the server.');
});
