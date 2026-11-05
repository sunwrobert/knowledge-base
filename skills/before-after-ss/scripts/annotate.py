#!/usr/bin/env python3
"""Capture a matched before/after screenshot pair with the changed element highlighted.

Usage:
  annotate.py --before-url URL --after-url URL --selector CSS_OR_ROLE \
    --out-dir DIR --slug SLUG [--viewport 1280x900] [--shape box|circle] \
    [--cdp http://localhost:29229] [--wait-selector CSS] [--scroll-y N] [--full-page] \
    [--wait-until load|domcontentloaded|networkidle] [--ready-selector CSS] [--setup FILE.py] \
    [--themes light,dark] [--no-theme-check]

Each URL is loaded in a fresh page on the same viewport and the same
--scroll-y, carrying the attached Chrome's cookies so signed-in routes stay
signed in. The element matched by --selector is located, its bounding box is
read from the browser, and a red highlight is drawn around it on the saved PNG.
If the target sits outside the viewport on either side, the script exits and
asks for a shared --scroll-y or --full-page rather than scrolling one side.
Every pair is captured once per theme in --themes (default light,dark), so
output files are <out-dir>/<slug>-<theme>-before.png and
<out-dir>/<slug>-<theme>-after.png. Each theme is set the way the app sets it:
the page's prefers-color-scheme is emulated and the next-themes `theme`
localStorage key is written before load. After load the script checks that
<html> carries the `dark` class exactly when the theme is dark, and exits if
the page ignored the theme (--no-theme-check skips this for surfaces themed
by media query or a data attribute). Storybook iframe.html URLs get
`theme:<theme>` merged into their `globals` query parameter.
Geometry for both shots is printed as JSON so the caption can quote it.

--selector accepts a CSS selector or a Playwright locator prefix such as
`role=button[name="Save"]` or `text=Save`. If the element is missing on one
side (for example the before side renders a different tag), pass
--before-selector or --after-selector to override that side only.

States a bare URL cannot reach (an open dialog, an expanded row, a wizard
step) take --setup FILE.py: a Python file defining `setup(page)` that is run
on both sides after the page loads and before the target is located. It uses
the Playwright page API (page.click, page.fill, page.get_by_role) and must
leave both sides in the same state. Pass --ready-selector for a marker that
proves the page is hydrated before setup clicks anything, and --wait-selector
for a marker that proves the captured state has settled. `load` fires before
application fetches finish, so a surface that populates asynchronously needs
--wait-selector or the pair can show different intermediate states.

The attached Chrome's storage_state() only contains localStorage for origins
it has visited. Open each capture origin once in Chrome before running when
the login lives in localStorage.

Requires: python3, playwright (`pip install playwright`), Pillow, and a
Chrome exposing CDP (default http://localhost:29229) or `playwright install
chromium` for --launch mode.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections.abc import Callable
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from PIL import Image, ImageDraw
from playwright.sync_api import Browser, Page, sync_playwright

PAD = 8
STROKE = 4
COLOR = (232, 64, 64, 255)


def parse_viewport(value: str) -> tuple[int, int]:
    w, h = value.lower().split("x")
    return int(w), int(h)


def storage_state(browser: Browser) -> dict | None:
    """Cookies and localStorage of the attached Chrome's signed-in context, so protected routes stay signed in."""
    if not browser.contexts:
        return None
    return browser.contexts[0].storage_state()


def browser_hostname(url: str) -> str:
    """Hostname as the browser reports location.hostname, keeping the brackets around an IPv6 literal."""
    host = urlsplit(url).hostname or ""
    return f"[{host}]" if ":" in host else host


def local_storage_seed(state: dict | None, url: str) -> dict[str, str]:
    """localStorage saved for the same hostname as url on any port, so base and branch dev servers share the login without leaking other sites."""
    if not state:
        return {}
    host = urlsplit(url).hostname
    return {
        item["name"]: item["value"]
        for origin in state.get("origins", [])
        if urlsplit(origin["origin"]).hostname == host
        for item in origin.get("localStorage", [])
    }


def themed_url(url: str, theme: str) -> str:
    """Storybook iframe URLs take the theme as a global, merged into any existing globals; app URLs are returned unchanged."""
    parts = urlsplit(url)
    if "iframe.html" not in parts.path:
        return url
    query = parse_qsl(parts.query, keep_blank_values=True)
    existing = next((v for k, v in query if k == "globals"), "")
    entries = [e for e in existing.split(";") if e and not e.startswith("theme:")]
    query = [(k, v) for k, v in query if k != "globals"] + [("globals", ";".join([*entries, f"theme:{theme}"]))]
    return urlunsplit(parts._replace(query=urlencode(query, safe=":;")))


def load_setup(path: str | None) -> Callable[[Page], None] | None:
    """The setup(page) function from a --setup file, run on both sides before the target is located."""
    if not path:
        return None
    spec = importlib.util.spec_from_file_location("before_after_setup", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"--setup {path}: not a loadable Python file")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    setup = getattr(module, "setup", None)
    if not callable(setup):
        raise SystemExit(f"--setup {path}: must define setup(page)")
    return setup


def capture(
    browser: Browser,
    state: dict | None,
    url: str,
    selector: str,
    out: Path,
    viewport: tuple[int, int],
    scale: int,
    wait_selector: str | None,
    scroll_y: int,
    full_page: bool,
    wait_until: str,
    ready_selector: str | None,
    setup: Callable[[Page], None] | None,
    theme: str,
    check_theme: bool,
) -> dict:
    url = themed_url(url, theme)
    context = browser.new_context(
        viewport={"width": viewport[0], "height": viewport[1]},
        device_scale_factor=scale,
        storage_state=state,
        color_scheme=theme,
    )
    seed = local_storage_seed(state, url)
    if seed:
        context.add_init_script(
            f"if (location.hostname === {json.dumps(browser_hostname(url))}) "
            f"for (const [k, v] of Object.entries({json.dumps(seed)})) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);"
        )
    context.add_init_script(f"try {{ localStorage.setItem('theme', {json.dumps(theme)}); }} catch {{}}")
    page = context.new_page()
    page.goto(url, wait_until=wait_until)
    if ready_selector:
        page.wait_for_selector(ready_selector, state="visible")
    if setup:
        setup(page)
    if wait_selector:
        page.wait_for_selector(wait_selector, state="visible")
    target = page.locator(f"{selector} >> visible=true").first
    target.wait_for(state="visible")
    is_dark = check_theme and page.evaluate("document.documentElement.classList.contains('dark')")
    if check_theme and is_dark != (theme == "dark"):
        raise SystemExit(f"{url}: asked for the {theme} theme but <html> {'has' if is_dark else 'lacks'} the dark class")
    page.evaluate("y => window.scrollTo(0, y)", scroll_y)
    page.wait_for_timeout(300)
    effective_scroll_y = page.evaluate("window.scrollY")
    if not full_page and effective_scroll_y != scroll_y:
        raise SystemExit(
            f"{url}: requested --scroll-y {scroll_y} but the page clamped to {effective_scroll_y:.0f}. "
            "Pick a --scroll-y both pages can reach or use --full-page."
        )
    box = target.bounding_box()
    if box is None:
        raise SystemExit(f"{url}: selector {selector!r} has no bounding box")
    in_viewport = 0 <= box["y"] and box["y"] + box["height"] <= viewport[1]
    if not full_page and not in_viewport:
        raise SystemExit(
            f"{url}: target is at viewport y={box['y']:.0f}, outside the {viewport[1]}px viewport. "
            "Pass the same --scroll-y for both sides or use --full-page."
        )
    page.screenshot(path=str(out), full_page=full_page)
    if full_page:
        box = {**box, "y": box["y"] + page.evaluate("window.scrollY")}
    context.close()
    return {"url": url, "theme": theme, "selector": selector, "box": box, "viewport": list(viewport), "scale": scale, "scroll_y": scroll_y}


def draw(path: Path, box: dict, scale: int, shape: str) -> None:
    img = Image.open(path).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    x0 = (box["x"] - PAD) * scale
    y0 = (box["y"] - PAD) * scale
    x1 = (box["x"] + box["width"] + PAD) * scale
    y1 = (box["y"] + box["height"] + PAD) * scale
    width = STROKE * scale
    if shape == "circle":
        d.ellipse([x0, y0, x1, y1], outline=COLOR, width=width)
    else:
        d.rounded_rectangle([x0, y0, x1, y1], radius=6 * scale, outline=COLOR, width=width)
    Image.alpha_composite(img, overlay).convert("RGB").save(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--before-url", required=True)
    ap.add_argument("--after-url", required=True)
    ap.add_argument("--selector", required=True)
    ap.add_argument("--before-selector")
    ap.add_argument("--after-selector")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--viewport", default="1280x900")
    ap.add_argument("--scale", type=int, default=2)
    ap.add_argument("--shape", choices=["box", "circle"], default="box")
    ap.add_argument("--wait-selector")
    ap.add_argument("--scroll-y", type=int, default=0, help="scroll position applied to both pages before capture")
    ap.add_argument("--full-page", action="store_true")
    ap.add_argument("--wait-until", choices=["load", "domcontentloaded", "networkidle"], default="load", help="page.goto wait state; networkidle never settles on some dev servers")
    ap.add_argument("--ready-selector", help="marker that must be visible before --setup runs, so clicks land after hydration")
    ap.add_argument("--setup", help="Python file defining setup(page), run on both sides after load to reach the captured state")
    ap.add_argument("--themes", default="light,dark", help="comma-separated themes to capture; each gets its own before/after pair")
    ap.add_argument("--no-theme-check", action="store_true", help="skip the <html class=dark> check for surfaces themed by media query or a data attribute")
    ap.add_argument("--cdp", default="http://localhost:29229")
    ap.add_argument("--launch", action="store_true", help="launch headless chromium instead of attaching over CDP")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    viewport = parse_viewport(args.viewport)
    themes = [t.strip() for t in args.themes.split(",") if t.strip()]
    if not themes or any(t not in ("light", "dark") for t in themes):
        raise SystemExit(f"--themes {args.themes!r}: use light, dark, or light,dark")

    pairs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True) if args.launch else p.chromium.connect_over_cdp(args.cdp)
        state = None if args.launch else storage_state(browser)
        setup = load_setup(args.setup)
        for theme in themes:
            before_path = out_dir / f"{args.slug}-{theme}-before.png"
            after_path = out_dir / f"{args.slug}-{theme}-after.png"
            before = capture(browser, state, args.before_url, args.before_selector or args.selector, before_path, viewport, args.scale, args.wait_selector, args.scroll_y, args.full_page, args.wait_until, args.ready_selector, setup, theme, not args.no_theme_check)
            after = capture(browser, state, args.after_url, args.after_selector or args.selector, after_path, viewport, args.scale, args.wait_selector, args.scroll_y, args.full_page, args.wait_until, args.ready_selector, setup, theme, not args.no_theme_check)
            pairs.append((before, before_path, after, after_path))
        if args.launch:
            browser.close()

    for before, before_path, after, after_path in pairs:
        draw(before_path, before["box"], args.scale, args.shape)
        draw(after_path, after["box"], args.scale, args.shape)
    json.dump(
        {before["theme"]: {"before": {**before, "file": str(before_path)}, "after": {**after, "file": str(after_path)}} for before, before_path, after, after_path in pairs},
        sys.stdout,
        indent=2,
    )
    print()


if __name__ == "__main__":
    main()
