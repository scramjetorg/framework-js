const axios = require('axios').default;
import {JSDOM} from 'jsdom';

(async () => {
	const baseUrl = 'https://en.wikipedia.org';

	const response = await axios.get(`${baseUrl}/wiki/Main_Page`);
	const { document } = (new JSDOM(response.data)).window;

	const links: Set<string> = new Set(Array.from(document.querySelectorAll( 'a' ))
		.map(el => el.getAttribute('href') || '')
		.filter(href => href.startsWith('/wiki/') && !href.includes(':')));

	console.log(links);
	console.log('---'.repeat(20));

	const results: Set<string> = new Set();
	const counter: Map<string,number> = new Map();
	// for await(const link of links) {
	// 	console.log('>', link);
	// 	const category = await axios.get(`${baseUrl}${link}`);
	// 	extractCategories(category.data, results, counter); // Side-effects :(
	// }

	// Above could by also done in parallel like above.
	// Limiting concurrent request should be added.
	const categoryRequests = Array.from(links).map(link => {
		return new Promise<void>(async res => { // No error handling...
			const category = await axios.get(`${baseUrl}${link}`);
			console.log('>', link);
			extractCategories(category.data, results, counter); // Side-effects :(
			res();
		});
	});
	await Promise.all(categoryRequests);

	console.log('---'.repeat(20));
	const catsMap: Map<string,number> = new Map(Array.from(counter.entries()).filter(entry => entry[1] > 1).sort());
	console.log( catsMap );
} )();

function extractCategories(html: string, results: Set<string>, counter: Map<string,number>): void {
	const { document } = (new JSDOM(html)).window;
	const catLinks = document.querySelector('div[class*=mw-normal-catlinks]');

	if (catLinks) {
		catLinks.querySelectorAll('a').forEach(link => {
			const linkText = link.textContent || '';
			console.log(linkText);
			results.add(linkText);
			counter.set(linkText, (counter.get(linkText) || 0) + 1);
		});
	}
}
