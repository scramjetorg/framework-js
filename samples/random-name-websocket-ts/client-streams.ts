import WebSocket = require('ws');

const namesNr = process.argv[2] || '10';
const ws = new WebSocket('ws://127.0.0.1:8080');
const wss = WebSocket.createWebSocketStream(ws, { encoding: 'utf8' });

wss.pipe(process.stdout); // requires transformation into "Nr.1 Name\n"

console.log( 'Connected and piped to WS server!' );

// Request X names.
console.log(`Requesting ${ namesNr } random names...`);
wss.write(namesNr);

wss.on('end', () => {
	console.log('Connection closed by the server.');
});
