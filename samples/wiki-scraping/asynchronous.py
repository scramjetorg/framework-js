from bs4 import BeautifulSoup
from collections import Counter
from pprint import pprint
import asyncio
import aiohttp

start = 'https://en.wikipedia.org/wiki/Main_Page'
LIMIT = None

categories = []

def extract_categories(page_html, result_list=categories):
    parsed = BeautifulSoup(page_html, 'html.parser')
    cat_links = parsed.find('div', attrs={'class':'mw-normal-catlinks'})
    if cat_links:
        for link in cat_links.find_all('a'):
            print(link.text)
            result_list.append(link.text)

async def main():
    async with aiohttp.ClientSession() as session:
        async with session.get(start) as response:
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')

            all_hrefs = [link.get("href") for link in soup.find_all('a')[:LIMIT]]
            page_links = [
                h for h in set(all_hrefs)
                if h and h[0:6] == '/wiki/' and ':' not in h
            ]

        pprint(page_links)
        print("---"*20)

        async def analyze_page(link):
            url = f'https://en.wikipedia.org/{link}'
            print(f"Requesting {url}...")
            async with session.get(url) as response:
                print(f'\033[1;97m{link}\033[0m: {response.status}')
                html = await response.text()
                extract_categories(html)

        await asyncio.gather(
            *[analyze_page(l) for l in page_links]
        )

asyncio.run(main())

print("---"*20)
counts = Counter(categories)
pprint({cat: count for cat, count in counts.items() if count > 1})
