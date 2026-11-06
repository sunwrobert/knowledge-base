#!/usr/bin/env python3
"""Headless-Chrome checks for a built explainer.

Usage: check.py <built.html> [shots_dir]

1. Loads <built.html>#sweep: renders the whole timeline at 0.05 s steps, fires every SFX and music step, and reports frames, audio state, and any script error.
2. Screenshots every scene at 85% of its duration (canvas only, cropped to 1280x720 with ImageMagick when available) plus one wipe frame, and the page in a 390px iframe, then builds sheet.png with ImageMagick montage when available.
3. Scans the file for network APIs, external URLs, and key-like strings.
Exits non-zero on any failure.
"""
import html as H, json, pathlib, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

CHROME = next((c for c in ("google-chrome", "chromium", "chromium-browser", "chrome") if shutil.which(c)), None)
FLAGS = ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"]


def chrome(*args: str) -> str:
    with tempfile.TemporaryDirectory() as prof:
        r = subprocess.run([CHROME, *FLAGS, f"--user-data-dir={prof}", *args], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f"chrome exited {r.returncode}: {r.stderr.strip()[-300:]}")
    return r.stdout


def crop(png: pathlib.Path, geometry: str) -> None:
    if shutil.which("convert"):
        subprocess.run(["convert", str(png), "-crop", geometry, "+repage", str(png)], check=True)


def main() -> None:
    if not CHROME:
        sys.exit("check.py: no Chrome/Chromium on PATH")
    built = pathlib.Path(sys.argv[1]).resolve()
    shots = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else built.parent / "shots")
    shots.mkdir(parents=True, exist_ok=True)
    url = built.as_uri()
    failures: list[str] = []

    dom = chrome("--virtual-time-budget=20000", "--dump-dom", url + "#sweep")
    m = re.search(r'data-sweep="([^"]*)"', dom)
    err = re.search(r'<div id="err"[^>]*>([^<]*)<', dom)
    if not m:
        sys.exit("sweep did not finish (script error before EX.start?)\n" + (err.group(1) if err else ""))
    sweep = json.loads(H.unescape(m.group(1)))
    hidden = re.search(r'<div id="err"[^>]*\shidden', dom) is not None
    print(f"sweep: {sweep['frames']} frames, total {sweep['total']:.1f} s, audio {sweep['audio']}, error region {'hidden' if hidden else 'VISIBLE: ' + (err.group(1) if err else '')}")
    if not hidden:
        failures.append("script error during sweep")
    if not str(sweep["audio"]).startswith("running"):
        failures.append(f"audio did not run: {sweep['audio']}")

    jobs = [(f"{i + 1:02d}", sc["start"] + sc["dur"] * 0.85) for i, sc in enumerate(sweep["scenes"])]
    if len(sweep["scenes"]) > 1:
        jobs.append(("wipe", sweep["scenes"][1]["start"] + 0.2))
    manifest = shots / ".check-shots"
    owned = manifest.read_text().split() if manifest.is_file() else []
    for name in owned + [f"{n}.png" for n, _ in jobs] + ["mobile.png", "sheet.png"]:
        if re.fullmatch(r"[\w-]+\.png", name):
            (shots / name).unlink(missing_ok=True)
    manifest.write_text("\n".join([f"{n}.png" for n, _ in jobs] + ["mobile.png", "sheet.png"]) + "\n")

    def shoot(job: tuple[str, float]) -> None:
        name, t = job
        out = shots / (name + ".png")
        # headless Chrome reserves window chrome inside --window-size, so shoot taller and crop to the canvas
        chrome("--window-size=1280,900", "--virtual-time-budget=3000", f"--screenshot={out}", f"{url}#solo&t={t:.3f}")
        crop(out, "1280x720+0+0")

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(shoot, jobs))
    # headless windows have a minimum width, so the phone check renders the page in a 390px iframe
    frame = shots / "mobile-frame.html"
    frame.write_text(f'<body style="margin:0"><iframe src="{url}#t={jobs[0][1]:.3f}" style="width:390px;height:1600px;border:0"></iframe>')
    chrome("--window-size=600,1700", "--virtual-time-budget=4000", f"--screenshot={shots / 'mobile.png'}", frame.as_uri())
    frame.unlink()
    crop(shots / "mobile.png", "390x1600+0+0")
    missing = [n for n, _ in jobs if not (shots / f"{n}.png").is_file()] + ([] if (shots / "mobile.png").is_file() else ["mobile"])
    if missing:
        failures.append(f"screenshots missing: {missing}")
    if shutil.which("montage"):
        pngs = [str(shots / f"{n}.png") for n, _ in jobs if n != "wipe"]
        subprocess.run(["montage", *pngs, "-tile", "4x", "-geometry", "480x270+6+6", "-background", "#222", str(shots / "sheet.png")], check=True)
    print(f"shots: {shots} ({len(jobs)} scenes + mobile{', sheet.png' if shutil.which('montage') else ''})")

    src = built.read_text()
    code = "\n".join(re.findall(r"<script\b[^>]*>(.*?)</script\s*>", src, re.S | re.I))
    for pat, what in [(r"\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon", "network API"), (r"""(?:\b(?:src|href|data)\s*=\s*["']?|url\(\s*["']?)(?:[a-z]+:)?//""", "external asset"), (r"\bsk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}", "key-like string")]:
        hits = re.findall(pat, code if what == "network API" else src)
        if hits:
            failures.append(f"{what}: {hits[:3]}")
    print("static scan: " + ("clean" if not any(f.split(":")[0] in ("network API", "external asset", "key-like string") for f in failures) else "FAILED"))

    if failures:
        sys.exit("FAIL\n- " + "\n- ".join(failures))
    print("PASS")


main()
