#!/usr/bin/env python3
"""Build a single-file "bulk review" page from a JSON spec.

Usage:
    python3 build.py spec.json out.html

Spec shape (see ../references/spec-example.json):
    {
      "title": "Small fixes",
      "subtitle": "A selection of fixes from one sweep.",
      "repo": {"name": "your-org/your-repo", "url": "https://github.com/..."},
      "date": "13 September 2026",
      "author": {"name": "Author Name", "url": "https://github.com/<handle>"},
      "footer": ["optional paragraphs of plain HTML"],
      "fixes": [
        {
          "id": "url-safe-slug",
          "title": "Short noun phrase",
          "pr": {"number": 101, "url": "https://github.com/.../pull/101"},
          "tags": "package · area",
          "description": "One or two sentences of HTML. <code>inline</code> allowed.",
          "file": "src/routing/filter.ts",
          "diff": "unified diff body: lines starting with ' ', '+', '-', '@@'",
          "wire": [
            {
              "label": "Upstream request",
              "before": "{\n  \"timeout\": 30\n}",
              "after": "{\n  \"timeout\": 30,\n  \"retries\": 2\n}"
            }
          ]
        }
      ]
    }

`wire` is optional. Each entry is a before/after pair of payload text (the
request sent upstream, or the response returned to the caller). The two are
diffed line by line and rendered under the source excerpt so an adapter
change shows what actually moves on the wire.

`description` and `footer` are trusted HTML authored by whoever writes the
spec. Everything else is escaped. Do not feed this script a spec you did not
write or review.

The output has no external requests. Inter is embedded from
../references/Inter-subset.woff2 when present, else the system sans
stack is used. Colors live in the `:root` variables of CSS; replace them with the
project's design tokens when it has them.
"""

import base64
import difflib
import html
import json
import sys
from pathlib import Path

FONT_PATH = Path(__file__).resolve().parent.parent / "references" / "Inter-subset.woff2"

def esc(s: str) -> str:
    return html.escape(s, quote=True)


def font_face() -> str:
    if not FONT_PATH.exists():
        return ""
    data = base64.b64encode(FONT_PATH.read_bytes()).decode("ascii")
    return (
        "@font-face { font-family: 'Inter'; font-style: normal; font-weight: 100 900; "
        f"font-display: swap; src: url(data:font/woff2;base64,{data}) format('woff2'); }}\n"
    )


def render_diff(diff: str) -> str:
    rows = []
    old = new = 0
    for raw in diff.rstrip("\n").split("\n"):
        if raw.startswith("@@"):
            parts = raw.split()
            try:
                old = int(parts[1].lstrip("-").split(",")[0])
                new = int(parts[2].lstrip("+").split(",")[0])
            except (IndexError, ValueError):
                pass
            if rows:
                rows.append('<tr class="hunk"><td class="n"></td><td class="n"></td><td class="c">…</td></tr>')
            continue
        if raw.startswith("\\"):
            rows.append(f'<tr class="meta"><td class="n"></td><td class="n"></td><td class="c">{esc(raw)}</td></tr>')
            continue
        if raw.startswith("+"):
            kind, text = "add", raw[1:]
            ln_old, ln_new = "", str(new)
            new += 1
        elif raw.startswith("-"):
            kind, text = "del", raw[1:]
            ln_old, ln_new = str(old), ""
            old += 1
        else:
            kind, text = "ctx", raw[1:] if raw.startswith(" ") else raw
            ln_old, ln_new = str(old), str(new)
            old += 1
            new += 1
        sign = {"add": "+", "del": "−", "ctx": " "}[kind]
        rows.append(
            f'<tr class="{kind}"><td class="n">{ln_old}</td><td class="n">{ln_new}</td>'
            f'<td class="c"><span class="s">{sign}</span>{esc(text)}</td></tr>'
        )
    return "<table>" + "".join(rows) + "</table>"


def wire_diff(before: str, after: str) -> str:
    a = before.rstrip("\n").split("\n")
    b = after.rstrip("\n").split("\n")
    lines = list(difflib.unified_diff(a, b, n=max(len(a), len(b)), lineterm=""))
    return "\n".join(lines[2:])


def render_wire(entries: list) -> str:
    out = []
    for w in entries:
        if w["before"] == w["after"]:
            continue
        out.append(
            f'<figure class="wire" aria-label="Wire delta: {esc(w["label"])}">'
            f'<p class="file"><span class="wire-tag">wire</span>{esc(w["label"])}</p>'
            f'<div class="diff">{render_diff(wire_diff(w["before"], w["after"]))}</div></figure>'
        )
    return "".join(out)


def render_fix(i: int, fix: dict) -> str:
    pr = fix["pr"]
    fid = fix["id"]
    file_line = f'<p class="file">{esc(fix["file"])}</p>' if fix.get("file") else ""
    wire = render_wire(fix.get("wire", []))
    return f"""
<section class="fix" id="{esc(fid)}">
  <h2><a class="ordinal" href="#{esc(fid)}" aria-label="Permalink to fix {i}">{i:02d}</a>{esc(fix["title"])}</h2>
  <aside class="citation"><a href="{esc(pr["url"])}" class="pr-link">PR #{pr["number"]}</a><p>{esc(fix.get("tags", ""))}</p></aside>
  <p class="description">{fix["description"]}</p>
  <figure aria-label="Source excerpt: removed lines marked minus, added lines marked plus">
    {file_line}
    <div class="diff">{render_diff(fix["diff"])}</div>
  </figure>{wire}
</section>"""


CSS = """
:root {
  --ink: #111827; --bg: #FAFAFA; --accent: #2563EB; --accent-2: #0E7490;
  --card: #FFFFFF; --muted: rgba(17,24,39,.04); --muted-fg: rgba(17,24,39,.66);
  --border: rgba(17,24,39,.12); --border-strong: rgba(17,24,39,.16);
  --accent-subtle: rgba(37,99,235,.08); --accent-2-subtle: rgba(14,116,144,.08);
  --code-bg: #111827; --code-fg: #E5E7EB;
  --positive: #16A34A; --negative: #DC2626;
  --sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Monaco, 'Cascadia Code', monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--sans); background: var(--bg); color: var(--ink); line-height: 1.55; font-size: 16px;
  -webkit-font-smoothing: antialiased; font-feature-settings: 'case' 1, 'calt' 0; padding-bottom: 72px; }
a { color: inherit; text-decoration: none; }
main { max-width: 1160px; margin: 0 auto; padding: 56px 32px 0; }
header.page-head { margin-bottom: 60px; max-width: 880px; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted-fg); margin-bottom: 16px; }
.eyebrow .ticket { color: var(--accent); font-weight: 600; background: var(--accent-subtle); padding: 2px 8px; border-radius: 6px; margin-right: 10px; }
h1 { font-weight: 700; font-size: 44px; line-height: 1.08; letter-spacing: -0.03em; margin-bottom: 22px; }
h1 em { font-style: normal; color: var(--accent); }
.lede { font-size: 16.5px; max-width: 760px; }
.byline { margin-top: 14px; font-family: var(--mono); font-size: 12px; color: var(--muted-fg); }
.byline a { color: var(--ink); }
.fix { display: grid; grid-template-columns: minmax(0, 1fr) 200px; column-gap: 40px; margin-bottom: 68px; padding-top: 24px; border-top: 2px solid var(--ink); }
.fix h2 { grid-column: 1; display: flex; align-items: baseline; gap: 16px; font-weight: 700; font-size: 27px; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 14px; }
.ordinal { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--accent); flex-shrink: 0; }
.citation { grid-column: 2; grid-row: 1 / span 3; font-family: var(--mono); font-size: 12px; line-height: 1.5; color: var(--muted-fg); padding-top: 6px; }
.pr-link { display: inline-block; color: var(--accent); font-weight: 600; background: var(--accent-subtle); padding: 2px 8px; border-radius: 6px; }
.citation p { margin-top: 10px; text-transform: uppercase; letter-spacing: .04em; font-size: 11px; overflow-wrap: anywhere; }
.description { grid-column: 1; max-width: 68ch; font-size: 15.5px; text-wrap: pretty; }
.description code { font-family: var(--mono); font-size: .86em; background: var(--muted); border: 1px solid var(--border); padding: 1px 6px; border-radius: 6px; overflow-wrap: anywhere; }
figure { grid-column: 1; margin-top: 18px; min-width: 0; }
.file { font-family: var(--mono); font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted-fg); margin-bottom: 8px; overflow-wrap: anywhere; }
figure.wire { margin-top: 14px; }
.wire-tag { display: inline-block; font-weight: 600; color: var(--accent-2); background: var(--accent-2-subtle); padding: 1px 6px; border-radius: 5px; margin-right: 8px; }
figure.wire .diff { border-left: 3px solid var(--accent-2); }
.diff { background: var(--code-bg); border-radius: 12px; overflow: hidden; }
.diff table { border-collapse: collapse; width: 100%; font: 12.5px/1.75 var(--mono); tab-size: 2; color: var(--code-fg); }
.diff td { padding: 0; white-space: pre-wrap; overflow-wrap: anywhere; vertical-align: top; }
.diff td.n { width: 1%; white-space: nowrap; text-align: right; padding: 0 8px; color: rgba(229,231,235,.35); user-select: none; }
.diff td.c { padding: 0 16px 0 8px; }
.diff .s { display: inline-block; width: 14px; color: rgba(229,231,235,.45); }
.diff tr.add td.c { background: rgba(22,163,74,.16); }
.diff tr.add td.n { color: rgba(22,163,74,.8); }
.diff tr.add .s { color: var(--positive); }
.diff tr.del td.c { background: rgba(220,38,38,.16); }
.diff tr.del td.n { color: rgba(220,38,38,.8); }
.diff tr.del .s { color: var(--negative); }
.diff tr.hunk td, .diff tr.meta td { color: rgba(229,231,235,.35); line-height: 1.4; }
.diff tr.hunk td.c { text-align: center; }
footer { margin-top: 8px; padding-top: 24px; border-top: 2px solid var(--ink); }
footer .note { font-size: 13.5px; color: var(--muted-fg); max-width: 760px; }
footer .note p + p { margin-top: 10px; }
@media (max-width: 900px) {
  h1 { font-size: 34px; }
  .fix { grid-template-columns: 1fr; }
  .citation { grid-column: 1; grid-row: auto; padding-top: 0; margin-bottom: 12px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
  .citation p { margin: 0; }
}
"""


def build(spec: dict) -> str:
    fixes = spec["fixes"]
    repo = spec["repo"]
    author = spec.get("author")
    byline_parts = [f'<a href="{esc(repo["url"])}">{esc(repo["name"])}</a>']
    if spec.get("date"):
        byline_parts.append(esc(spec["date"]))
    if author:
        byline_parts.append(f'<a href="{esc(author["url"])}">{esc(author["name"])}</a>')
    footer = "".join(f"<p>{p}</p>" for p in spec.get("footer", []))
    sections = "".join(render_fix(i + 1, f) for i, f in enumerate(fixes))
    title = spec.get("title", "Small fixes")
    head, _, tail = title.partition(" ")
    h1 = f"<em>{esc(head)}</em> {esc(tail)}" if tail else f"<em>{esc(title)}</em>"
    page_title = f'{title} in {repo["name"]}'
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="theme-color" content="#FAFAFA">
<title>{esc(page_title)}</title>
<meta name="description" content="{esc(spec.get("subtitle", ""))}">
<style>{font_face()}{CSS}</style>
</head><body>
<main>
<header class="page-head">
  <div class="eyebrow"><span class="ticket">{len(fixes)} PRs</span>{esc(repo["name"])}</div>
  <h1>{h1}</h1>
  <p class="lede">{esc(spec.get("subtitle", ""))}</p>
  <p class="byline">{" · ".join(byline_parts)}</p>
</header>
{sections}
<footer><div class="note">{footer}</div></footer>
</main>
</body></html>
"""


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    with open(sys.argv[1]) as f:
        spec = json.load(f)
    out = build(spec)
    with open(sys.argv[2], "w") as f:
        f.write(out)
    print(f"wrote {sys.argv[2]} ({len(spec['fixes'])} fixes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
