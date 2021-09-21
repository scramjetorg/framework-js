const { StringStream } = require('scramjet');
import WebSocket = require('ws');

const namesNr = process.argv[2] || '10';
const ws = new WebSocket('ws://127.0.0.1:8080');
const wss = WebSocket.createWebSocketStream(ws, { encoding: 'utf8' });

const output = new StringStream();
wss.pipe(output);

let counter = 0;
output.map((el: string) => {counter++; return `${ counter }. ${el}`}).append('\n').pipe(process.stdout);

const input = new StringStream();
input.pipe(wss);

console.log( 'Connected and piped to WS server!' );

// Request X names.
console.log(`Requesting ${ namesNr } random names...`);
input.write(namesNr);

output.on('end', () => {
	input.end()
	console.log('Connection closed by the server.');
});
