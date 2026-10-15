"""Static browser reading exchange. No personal payload is sent to this server."""
from pathlib import Path
from flask import send_file, abort

ROOT = Path(__file__).parent
CHARACTERS = {"ruth", "joseph", "mary", "esther", "abraham", "thomas", "hannah", "peter", "moses", "david"}

def register_together(app):
    def secured(response):
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/together")
    @app.get("/together/")
    def together_page():
        return secured(send_file(ROOT / "together.html"))

    @app.get("/together/<name>")
    def together_static(name):
        if name not in {"codec.js", "web.js", "styles.css", "conversation.js"}:
            abort(404)
        return secured(send_file(ROOT / name))

    @app.get("/together/assets/<character>.png")
    def together_art(character):
        if character not in CHARACTERS:
            abort(404)
        return secured(send_file(ROOT / "together-assets" / (character + ".png")))
