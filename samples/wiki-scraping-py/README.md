# Wikipedia scraping

Sample showing scraping Wikipedia for information. The goal is to find what are the most common categories of pages that are linked to from Wikipedia main page.

* `simple.py` - simplest implementation in plain python (synchronous),
* `asynchronous.py` - asynchronous python implementation

```bash
virtualenv -p python3 venv
. venv/bin/activate
pip install -r requirements.txt

python3 simple.py
python3 asynchronous.py
```
