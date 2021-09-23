# Random Names Websocket (Python)

Sample shows how to create a websocket server which will send number of
different names to a client when requested.

Install dependencies first:

```bash
virtualenv -p python3 venv
. venv/bin/activate
pip install -r requirements.txt
```

Run server and client (in two separate shell sessions):

```
python3 server.py
python3 client.py
```

You can also mix python client with JS server (from another example) and vice
versa.
