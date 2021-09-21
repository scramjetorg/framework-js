from bs4 import BeautifulSoup
from collections import Counter
from pprint import pprint
import requests

start = 'https://en.wikipedia.org/wiki/Main_Page'
LIMIT = None

html = requests.get(start).text
soup = BeautifulSoup(html, 'html.parser')

categories = []

all_hrefs = [link.get("href") for link in soup.find_all('a')[:LIMIT]]
page_links = [
    h for h in set(all_hrefs)
    if h and h[0:6] == '/wiki/' and ':' not in h
]

def extract_categories(page_html, result_list=categories):
    parsed = BeautifulSoup(page_html, 'html.parser')
    cat_links = parsed.find('div', attrs={'class':'mw-normal-catlinks'})
    if cat_links:
        for link in cat_links.find_all('a'):
            result_list.append(link.text)

for link in page_links:
    print(link)
    html = requests.get(f'https://en.wikipedia.org/{link}').text
    extract_categories(html)

print("---"*20)
counts = Counter(categories)
pprint({cat: count for cat, count in counts.items() if count > 1})
