---
name: makefaster
description: >-
  Autoresearch loop that makes the current repo's site measurably faster: a Lighthouse baseline of a user-felt metric, then a ranked checklist of performance techniques plus up to five hypotheses of your own, one per iteration, each kept or reverted by the numbers and recorded in a local results.json. Use to make a site faster, improve LCP or Core Web Vitals, or run a performance loop.
metadata:
  version: 1.1.1
---

# The makefaster loop

Adapted from [jjcm/makefaster](https://github.com/jjcm/makefaster), except that it submits nothing. Run to completion in one session.

## Session files

`.makefaster/` in the target repo, listed in `.git/info/exclude` and never committed, holds `results.json`, the Lighthouse profile and reports, and `improvements.json`: the ranked checklist that fixes the run's order and length, copied from this skill or from the path or URL the user gives.

## Progress lines

One line as each step begins, with only these tags and no paths, commands, or diffs:

```
[INITIALIZING] Building the production bundle and starting the server.
[TEST] Running Lighthouse for the initial baseline.
[CHECKLIST] Walking 49 categories in rank order, then up to 5 of my own.
[SKIP] Precompress Static Assets, because the CDN already compresses every text response.
[TRY] Lazy-Load Components
[RESULT] -410ms / -14.2% cold LCP, kept.
[EXTRA] 5 follow-ups chosen: worker offload, srcset rungs, DNS prefetch, JSON slimming, sprite atlas.
[DONE] Checklist and 5 extras finished with 6 keeps; stopping.
```

## Step 0: serve the site

Serve the production build, never the dev server, and pick the entry page users hit first.

## Step 1: baseline

1. Launch Lighthouse exactly like this for every sample:

   ```sh
   mkdir -p .makefaster/lh
   npx --yes lighthouse <url> --output=json --quiet \
     --chrome-flags="--headless=new --user-data-dir=./.makefaster/chrome-profile --no-first-run --no-default-browser-check" \
     > .makefaster/lh/<label>.json
   ```

   Read `audits.largest-contentful-paint.numericValue`, `audits.interactive.numericValue`, `audits.first-contentful-paint.numericValue`, `audits.total-blocking-time.numericValue`, `audits.cumulative-layout-shift.numericValue`, `categories.performance.score`.

2. Only if Lighthouse cannot run: curl timings (TTFB, transfer time, bytes of the entry page and critical assets). Set `northStar: "ttfb"`, use `ttfbMs`/`transferMs` in place of `lcpMs`/`ttiMs` throughout `results.json`, and say so in `profilingTool`.

Run Lighthouse in its own isolated `--user-data-dir`; without it Lighthouse opens a tab in the user's running Chrome. Never attach to the user's browser (`--port`, `connect`, `connectOverCDP`). `CHROME_PATH` picks the executable only.

- Measure cold and warm when possible (warm: `--disable-storage-reset` after a priming run on the same profile).
- At least 3 runs per condition. Take the median; the spread is the noise floor.
- The north star is LCP or its closest proxy. TTI is secondary; a TBT-derived proxy or reused LCP is noted in `profilingTool`.
- Write the baseline to `results.json` before touching code.

## Step 2: the whole checklist in rank order, then up to five extras

The order is fixed so runs compare. Profiling decides viability and extras, never order.

For each category:

1. Judge viability by reading, not by spending an iteration: already done? surface exists? plausibly on the critical path? One baseline request for the entry page and heaviest assets with `Accept-Encoding: gzip, br` answers every compression row (`content-encoding`) and caching row (`cache-control`, `etag`, content-hashed filenames).
2. Not viable: `[SKIP] <category>, <one reason>` and no `iterations[]` row. Never skip an applicable category to finish sooner.
3. Viable: `[TRY] <category>`. Make the smallest cleanly revertable change, rebuild and restart so the server serves it (also before the final pass), re-measure exactly like the baseline (same URL, run count, conditions, median), and keep or revert.

After a keep, skip the later rows it already covers and name it (`[SKIP] Enable Gzip Compression, covered by the precompression keep`): the kept row's `subsumes` list, plus any unlisted row the keep already does. Never skip a row because it resembles a miss.

If the entry page is a prebuilt artifact this repo doesn't build (downloaded tarball, vendored bundle, committed compiled SPA), try only server-side rows (compression, cache headers, the in-repo HTML template) and skip artifact-internal rows with a reason. Hand-editing compiled output is not a keep.

Extras come only after the checklist: up to five hypotheses not on it, from this codebase's profile ([jjcm/speedupskill](https://github.com/jjcm/speedupskill) is a measured technique catalog). Announce `[EXTRA] <n> follow-ups chosen: …` and run each under the same rules. Fewer is fine; say so in `[DONE]`.

### Keep or revert

- Keep (`kept: true`) only if the north star beats the noise floor and improves by at least 5% or 20 ms, whichever is larger. An FCP win that regresses LCP is not a keep.
- Otherwise revert completely and record `kept: false`. A revert streak changes nothing.
- `[RESULT] <delta>, kept` or `[RESULT] <delta>, reverted, below the noise floor`.

### Record every measurement

Rewrite `results.json` (valid JSON at all times) when each `[TEST]` finishes: generic `name` (never blank), `description`, `category`, `notes`, `deltaMs`/`deltaPct` (north star vs previous kept state, negative when faster), `measured` (medians per mode, `baseline` shape), `kept` (always present). On a keep, refresh `results.final`. Misses are rows; skips are not; no row without numbers.

## Naming an improvement

`name`, `category`, and `description` name a generic technique as a present-tense instruction to the next site. Site detail (files, bytes, revert reason) goes in `notes`. The three generic fields never contain proper nouns, file or module names, sizes, versions, counts, CSS classes, routes, process footnotes like `(second attempt)`, or changelog voice (`Added…`): `Lazy-load Hidden 262KB Changelog Rocket.gif` becomes `Lazy-load unseen images`, and `Playfair Display 4 Weights → 1` becomes `Reduce font payload`.

Reuse a checklist category's name and description when one fits. One technique is one category (`Lazy-load the Settings Modal` and `Lazy-load the JSON Editor` are the same). Use `category: null` when nothing fits and no generic name works.

## Step 3: stop rule

Stop only when every category is tried or skipped in rank order and the extras are spent or you are out of honest ideas (`stoppedReason: "checklist-complete"`), or when the user stops you (`"user"`). No miss limit or run count ends the session.

Before exit:

1. Final full pass (cold and warm) into `results.final`.
2. Only if the user asked and the branch is pushable, open a PR with the measured deltas and put its URL in `site.prUrl`.
3. Set `stoppedReason`, confirm every iteration is recorded, and report `[DONE] <one sentence>` with the keep count and the baseline-to-final north-star delta.

## Discipline

- Lab harnesses, profiling scripts, and rejected experiments stay in `.makefaster/` or get deleted, never in the site.
- Known traps: preloading grid thumbnails, `fetchpriority` washes, caching error responses, `srcset` rungs bigger than the CSS slot.

## `results.json` schema

Times in milliseconds.

```json
{
  "version": 1,
  "site": { "url": "example.com", "name": "Example", "prUrl": "https://github.com/org/example/pull/1" },
  "northStar": "lcp",
  "profilingTool": "lighthouse 12.x, median of 3 runs, headless Chrome",
  "noiseFloor": { "lcpMs": 40, "ttiMs": 60 },
  "baseline": {
    "cold": { "lcpMs": 2400, "ttiMs": 3900, "fcpMs": 1400, "tbtMs": 310, "cls": 0.08, "score": 72 },
    "warm": { "lcpMs": 1100, "ttiMs": 1700, "fcpMs": 600, "tbtMs": 120 }
  },
  "final": { "cold": { "lcpMs": 1750, "ttiMs": 3050 }, "warm": { "lcpMs": 780, "ttiMs": 1240 } },
  "iterations": [
    {
      "n": 1,
      "name": "Inline critical CSS",
      "description": "Inline the above-the-fold rules first paint needs and load the rest of the stylesheet asynchronously",
      "category": "Inline Critical CSS",
      "notes": "Extracted the 4.1KB of rules the hero uses out of app.css into <style> in index.html",
      "phase": "checklist",
      "measured": { "cold": { "lcpMs": 2140, "ttiMs": 3700 } },
      "deltaMs": -260,
      "deltaPct": -10.8,
      "kept": true
    }
  ],
  "stoppedReason": "checklist-complete"
}
```

- `site` is optional: `site.url` is the bare domain when obvious, `site.prUrl` only when a PR was opened.
- `baseline` and `final` are medians per mode: `lcpMs` and `ttiMs` required per included mode, `fcpMs`, `tbtMs`, `cls`, `score` optional. Re-measure `final` after the last keep and again before exit.
- `iterations[].phase` is `"checklist"` or `"extra"`.
- `stoppedReason` is `null` while running.
