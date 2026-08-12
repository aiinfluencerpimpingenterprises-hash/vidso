#!/usr/bin/env python3
"""Local dev server for the Vidso static site.

Serves the repository root as static files while faithfully applying the
`rewrites`, `redirects`, `trailingSlash` and `headers` rules declared in
`vercel.json`, so local development matches Vercel production routing without
needing the Vercel CLI or a Vercel login.

Usage:
    python3 scripts/dev-server.py [--port 3000] [--host 0.0.0.0]
"""
import argparse
import json
import mimetypes
import os
import posixpath
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("video/mp4", ".mp4")


def load_config():
    with open(os.path.join(ROOT, "vercel.json"), "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    return {
        "trailingSlash": cfg.get("trailingSlash", True),
        "rewrites": cfg.get("rewrites", []),
        "redirects": cfg.get("redirects", []),
        "headers": cfg.get("headers", []),
    }


CONFIG = load_config()


def match_source(source, path):
    """Vercel sources are literal paths (optionally with a regex-ish suffix)."""
    return source == path


def extra_headers_for(path):
    out = {}
    for rule in CONFIG["headers"]:
        try:
            if re.fullmatch(rule["source"], path):
                for h in rule.get("headers", []):
                    out[h["key"]] = h["value"]
        except re.error:
            if rule["source"] == path:
                for h in rule.get("headers", []):
                    out[h["key"]] = h["value"]
    return out


def resolve_fs_path(url_path):
    """Map a URL path to an on-disk file, applying clean-URL conventions."""
    clean = url_path.split("?")[0]
    rel = posixpath.normpath(clean).lstrip("/")
    candidate = os.path.join(ROOT, rel)
    # Prevent path traversal outside the repo root.
    if os.path.commonpath([os.path.abspath(candidate), ROOT]) != ROOT:
        return None
    if os.path.isfile(candidate):
        return candidate
    if os.path.isdir(candidate):
        index = os.path.join(candidate, "index.html")
        if os.path.isfile(index):
            return index
    html = candidate + ".html"
    if os.path.isfile(html):
        return html
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "VidsoDevServer/1.0"

    def _send_redirect(self, location, permanent=False):
        self.send_response(308 if permanent else 307)
        self.send_header("Location", location)
        self.end_headers()

    def _send_file(self, fs_path, url_path, head_only=False):
        ctype, _ = mimetypes.guess_type(fs_path)
        ctype = ctype or "application/octet-stream"
        try:
            with open(fs_path, "rb") as fh:
                data = fh.read()
        except OSError:
            self.send_error(404, "Not Found")
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for key, value in extra_headers_for(url_path).items():
            self.send_header(key, value)
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def _handle(self, head_only=False):
        path = urlsplit(self.path).path

        # 1) Explicit redirects from vercel.json
        for rule in CONFIG["redirects"]:
            if match_source(rule["source"], path):
                self._send_redirect(rule["destination"], rule.get("permanent", False))
                return

        # 2) trailingSlash:false -> strip trailing slash (except root)
        if not CONFIG["trailingSlash"] and path != "/" and path.endswith("/"):
            self._send_redirect(path.rstrip("/"), permanent=False)
            return

        # 3) Explicit rewrites from vercel.json (serve destination, keep URL)
        for rule in CONFIG["rewrites"]:
            if match_source(rule["source"], path):
                fs_path = resolve_fs_path(rule["destination"])
                if fs_path:
                    self._send_file(fs_path, path, head_only)
                    return

        # 4) Static file / clean-URL resolution
        fs_path = resolve_fs_path(path)
        if fs_path:
            self._send_file(fs_path, path, head_only)
            return

        self.send_error(404, "Not Found")

    def do_GET(self):
        self._handle(head_only=False)

    def do_HEAD(self):
        self._handle(head_only=True)

    def log_message(self, fmt, *args):
        print("[dev-server] " + (fmt % args))


def make_server(host, port):
    """Prefer dual-stack (::) so both localhost IPv4 and IPv6 work in Chrome."""
    import socket

    class DualStackServer(ThreadingHTTPServer):
        address_family = socket.AF_INET6

        def server_bind(self):
            # Accept IPv4-mapped connections too (Chrome often tries ::1 first for localhost).
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            super().server_bind()

    if host in ("0.0.0.0", "", "::"):
        try:
            return DualStackServer(("::", port), Handler)
        except OSError:
            # Fall back to IPv4-only if IPv6 is unavailable in the environment.
            return ThreadingHTTPServer(("0.0.0.0", port), Handler)
    return ThreadingHTTPServer((host, port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")))
    parser.add_argument("--host", default="0.0.0.0",
                        help="Bind address. Default 0.0.0.0 dual-stacks to :: when possible.")
    args = parser.parse_args()
    httpd = make_server(args.host, args.port)
    print(f"Vidso dev server running at http://127.0.0.1:{args.port}/ (also ::1 when dual-stack)")
    print(f"Root: {ROOT}")
    print("Routing (rewrites/redirects/trailingSlash) mirrors vercel.json")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
