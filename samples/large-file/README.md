Reading large text files
------------------------

See how Python and Nodejs behave when reading a large file.

Files can be downloaded from:
* https://scramjetorg-my.sharepoint.com/:t:/g/personal/jan_warchol_scramjet_org/EcmEA8LyuHlIvZePfGj_x8EBqaBDLqS2X8XqkRh6RNT1CQ?e=U6iTdf
* https://scramjetorg-my.sharepoint.com/:t:/g/personal/jan_warchol_scramjet_org/EepvA_x1UzhLsb7skRQUDfIBtFcxls_5PdVRUTsRXJ_fGg?e=ahBdb7

Running code:

```
virtualenv -p python3 venv
. venv/bin/activate
pip install -r requirements.txt

python default-streaming.py
python stream-in-chunks.py
python aiofiles-streaming.py

```
node default-streaming.mjs
```