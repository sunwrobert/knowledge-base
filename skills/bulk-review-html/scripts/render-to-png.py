#!/usr/bin/env python3
"""Render a bulk-review page to a full-page PNG for sharing.

Captures the entire document height at 2x scale, so a tall page comes out as a
single crisp image. Connects to a running Chrome over CDP when CDP_ENDPOINT is
set; otherwise launches Chrome from CHROME, or Playwright's bundled Chromium.

Usage:
    python3 render-to-png.py "file:///abs/path/to/<slug>.html" ~/<slug>.png

Env:
    CDP_ENDPOINT  Chrome DevTools Protocol endpoint, e.g. http://localhost:9222 (optional)
    CHROME        path to a Chrome or Chromium binary to launch (optional)

Requires the `playwright` Python package (and `playwright install chromium`
when no CDP endpoint is used).
"""

import os
import sys

from playwright.sync_api import sync_playwright


def render(url: str, out_path: str) -> None:
    endpoint = os.environ.get("CDP_ENDPOINT")
    with sync_playwright() as p:
        if endpoint:
            browser = p.chromium.connect_over_cdp(endpoint)
        else:
            browser = p.chromium.launch(executable_path=os.environ.get("CHROME") or None)
        context = browser.new_context(
            device_scale_factor=2,
            viewport={"width": 1280, "height": 1200},
        )
        page = context.new_page()
        page.goto(url, wait_until="networkidle")
        page.screenshot(path=out_path, full_page=True)
        page.close()
        context.close()
        if not endpoint:
            browser.close()


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    render(sys.argv[1], sys.argv[2])
    print(f"wrote {sys.argv[2]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
