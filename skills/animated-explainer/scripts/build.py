#!/usr/bin/env python3
"""Inline local <script src> files into one standalone HTML file, and replace __FONT__ with the bundled font as base64.

Usage: build.py <page.html> <out.html>
Script paths resolve relative to page.html.
"""
import base64, pathlib, re, sys

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "assets"


def resolve(name: str, base: pathlib.Path) -> pathlib.Path:
    cand = base / name
    if cand.is_file():
        return cand
    sys.exit(f"build.py: cannot find script {name!r} next to the page")


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    page = pathlib.Path(sys.argv[1]).resolve()
    html = page.read_text()

    def inline(m: re.Match) -> str:
        if re.match(r"(?:[a-z]+:)?//", m.group(1), re.I):
            sys.exit(f"build.py: external script {m.group(1)!r}; vendor it next to the page")
        src = resolve(m.group(1), page.parent).read_text().replace("</script", "<\\/script")
        return f"<script>\n{src}\n</script>"

    html = re.sub(r"""<script\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)["']?[^>]*>\s*</script\s*>""", inline, html, flags=re.I)
    if "__FONT__" in html:
        html = html.replace("__FONT__", base64.b64encode((ASSETS / "font.woff2").read_bytes()).decode())
    leftovers = [
        r for r in re.findall(r"""<(?:script|link|img|iframe|audio|video|source|embed|object)\b[^>]*?\b(?:src|href|data)\s*=\s*["']?([^"'\s>]+)""", html, re.I)
        if not r.startswith(("data:", "#"))
    ] + re.findall(r"""url\(\s*["']?((?!data:|#)[^"')\s]+)""", html)
    if leftovers:
        sys.exit(f"build.py: unresolved asset references remain: {leftovers[:5]}")
    pathlib.Path(sys.argv[2]).write_text(html)
    print(f"wrote {sys.argv[2]} ({len(html) // 1024} KB)")


main()
