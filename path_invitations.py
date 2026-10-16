"""Stateless invitation preview. Personal invitation data stays in the URL fragment."""
import os
from pathlib import Path
from urllib.parse import urlparse
from flask import send_file, jsonify, abort

ROOT = Path(__file__).parent

def register_path_invitations(app):
    def secured(response):
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Content-Security-Policy'] = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        return response

    @app.get('/path')
    @app.get('/path/')
    def path_page():
        return secured(send_file(ROOT / 'path.html'))

    @app.get('/path/<name>')
    def path_static(name):
        if name not in {'path-codec.js', 'path.js', 'path.css', 'catalog.json', 'passages.json'}:
            abort(404)
        file = {'catalog.json': 'path-catalog.json', 'passages.json': 'path-passages.json'}.get(name, name)
        return secured(send_file(ROOT / file))

    @app.get('/path/config')
    def path_config():
        raw = os.getenv('BIBLECOMPANION_DOWNLOAD_URL', '')
        parsed = urlparse(raw)
        # Do not invent an App Store listing or route users through arbitrary URLs.
        allowed = parsed.scheme == 'https' and parsed.hostname in {'apps.apple.com', 'testflight.apple.com'} and not parsed.username and not parsed.password
        return secured(jsonify({'downloadURL': raw if allowed else None}))
