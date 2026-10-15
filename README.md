# Bible Companion backend

I built this service to support the companion features in Bible Companion. I use it for conversation requests, reading journeys, reflection prompts, and shared reading pages.

I keep the request handling and personalization logic in `server.py`. The shared reading routes live in `together.py`, with their browser interface and artwork alongside them.

## Built with

I used Python, Flask, and the OpenAI Python library. The shared pages use HTML, CSS, and JavaScript.

## Inside the project

* `server.py`: the Flask application and companion routes.
* `together.py`: shared reading routes.
* `together.html`: the shared reading page.
* `together-assets/`: artwork used by the shared pages.
* `requirements.txt`: Python dependencies.

## Running it

I install `requirements.txt` in a Python environment, provide my own `OPENAI_API_KEY` through the environment, and start Flask with `python3 -m flask --app server run`. I use `gunicorn server:app` when running the service behind a production server.

I keep credentials in the server environment. The [iOS application](https://github.com/2MilinEcom/BIBLE-COMPANION) lives in its own repository.
