---
name: makefaster
description: Autoresearch loop that makes the site in the current repo measurably faster. Baseline a user-felt metric with Lighthouse, walk a ranked checklist of performance techniques one hypothesis per iteration, finish with up to five of your own, keep or revert by the numbers, and record everything in a local results.json. Use when asked to make a site faster, improve LCP or Core Web Vitals, run a performance loop, or hunt frontend performance wins. Self-contained, no external CLI or leaderboard.
---

# The makefaster loop

Make the site in the current directory measurably faster for real users, one
disciplined experiment at a time. **Measure a user-felt metric first, change one
hypothesis per iteration, keep or revert with numbers.** Take the run to
completion in one session.

This is a self-contained adaptation of the loop in
[jjcm/makefaster](https://github.com/jjcm/makefaster). It runs Lighthouse
directly and writes results locally. Nothing is submitted anywhere.

## Session files (`.makefaster/` in the target repo)

Create the directory on first use and add it to `.git/info/exclude`. Never
commit it.

| file                | what it is                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `improvements.json` | the ranked checklist. Copy `improvements.json` from this skill's directory, or take the path or URL the user gives |
| `results.json`      | the session record, rewritten after every iteration                                                                |
| `chrome-profile/`   | the isolated Chrome profile Lighthouse uses                                                                        |
| `lh/*.json`         | one Lighthouse report per sample                                                                                   |

`improvements.json` is **the order you work in and the length of the run**, not
a script to apply blindly. Judge whether each category is viable here before
spending an iteration on it, and skip the ones that are not.

## Reporting progress

Tell the user one short line as each step begins, using these tags and no
others:

```
[INITIALIZING] Building the production bundle and starting the server.
[TEST] Running Lighthouse for the initial baseline.
[CHECKLIST] Walking 49 categories in rank order, then up to 5 of my own.
[SKIP] Precompress Static Assets — the CDN already compresses every text response.
[TRY] Lazy-Load Components
[RESULT] -410ms / -14.2% cold LCP — kept.
[EXTRA] 5 follow-ups chosen: worker offload, srcset rungs, DNS prefetch, JSON slimming, sprite atlas.
[DONE] Checklist and 5 extras finished with 6 keeps; stopping.
```

One line, one sentence, one step. Say what you are doing, not which tool you
are using. No file paths, command strings or diffs in these lines.

## Step 0 — get the site running

Work out how the site is served (README, `package.json` scripts, Makefile,
Procfile, docker-compose). Get it running locally and identify the entry page
real users hit first. If the repo has a production build step, **measure the
production build, not the dev server.** Dev servers lie about performance.

## Step 1 — baseline profile

Use the heaviest-hitting **real, user-felt** metric you can measure on this
machine, preferring:

1. **Lighthouse**, launched exactly like this for every sample, with a distinct
   report file per sample:

   ```sh
   mkdir -p .makefaster/lh
   npx --yes lighthouse <url> --output=json --quiet \
     --chrome-flags="--headless=new --user-data-dir=./.makefaster/chrome-profile --no-first-run --no-default-browser-check" \
     > .makefaster/lh/<label>.json
   ```

   Read `audits.largest-contentful-paint.numericValue`,
   `audits.interactive.numericValue`, `audits.first-contentful-paint.numericValue`,
   `audits.total-blocking-time.numericValue`,
   `audits.cumulative-layout-shift.numericValue` and
   `categories.performance.score` from each report.

2. Last resort, only if Lighthouse cannot install or run here: **curl-level
   timings** (TTFB, full transfer time, total bytes of the entry page and
   critical assets). Weak but honest. Set `northStar: "ttfb"`, use `ttfbMs`
   and `transferMs` in place of `lcpMs` and `ttiMs` everywhere in
   `results.json`, and record in `profilingTool` that this is what you
   measured.

### The measurement browser is never the user's browser

- Always launch a **dedicated headless Chrome** with the isolated
  `--user-data-dir` above. A Chrome started without its own profile directory
  while the user's Chrome is running opens a tab in _their_ browser.
- Never pass `--port` to reuse an existing Chrome debugging port, and never
  attach with `connect` or `connectOverCDP`. A running debuggable Chrome you
  did not start is the user's.
- `CHROME_PATH` may pick the executable. It never picks an existing session.

### Rules

- Measure **cold** (empty cache) and **warm** (second visit, cache primed)
  whenever the tooling allows. For warm, run Lighthouse with
  `--disable-storage-reset` after a priming run against the same profile.
- **At least 3 runs per condition. Use the median.** Record the spread. That
  spread is your **noise floor** and the keep/revert rule depends on it.
- **North star** is LCP by default, or the closest proxy your tooling produces.
  TTI is secondary. If the tool cannot produce TTI, use a TBT-derived proxy or
  reuse LCP and say so in `profilingTool`.
- Write the baseline into `results.json` **before touching any code**.

## Step 2 — the loop: the whole checklist in order, then up to five of your own

**The order is not yours to choose, and neither is the length.** Work the
checklist top to bottom, all of it, then add up to five hypotheses of your own.
The run is `N + up to 5`, where `N` is the number of categories in
`improvements.json`. A fixed order is what makes one run comparable to the next.

Profiling still matters. It decides **whether** a category is viable here and
**what** your extras should be. It does not decide the order.

### 2a. Walk the checklist, one category per iteration

For each category in rank order:

1. **Check whether it is viable in this codebase.** A few minutes of reading,
   not an iteration. Already done? Does the stack have this surface? Plausibly
   on the critical path?

   **Probe once, decide many.** One request for the entry page and its heaviest
   assets with `Accept-Encoding: gzip, br` answers every compression row
   (`content-encoding`), and the same response headers answer the caching rows
   (`cache-control`, `etag`, content-hashed filenames). Take that look during
   the baseline and reuse it.

2. **Not viable → skip it, and say why.** `[SKIP] <category> — <one reason>`.
   A skip costs no measurement and gets no row in `iterations[]`. Never spend an
   iteration on something you already know does not apply, and never skip a
   category that does apply to reach the end sooner.
3. **Viable → spend one iteration on it.** `[TRY] <category>`, then:
   - **Implement the smallest change that tests it.** Make it cleanly
     revertable: commit it on the working branch, or keep the tree in a
     `git stash`-able state.
   - **Rebuild and restart** whatever the stack needs so the server is
     serving the changed code, not the baseline artifact. Do the same before
     the final pass.
   - **Re-measure exactly like the baseline** (`[TEST] …`). Same URL, same run
     count, same conditions, median again. Never compare a 1-run number to a
     3-run median.
   - **Keep or revert, by the numbers** (below).

### After a keep, skip what it subsumes

Some rows are the same technique under a narrower name. After a keep, skip any
later row the kept change already covers, naming the keep:
`[SKIP] Enable Gzip Compression — covered by the precompression keep`. A row
may carry a `subsumes` list. Trust it, and apply the rule with or without it.
Skip a row because the kept change already did it, never because it looks
similar to something that missed.

### When the LCP surface is a prebuilt artifact

If the entry page is served from an artifact this repo does not build (a
downloaded dashboard tarball, a vendored bundle, a compiled SPA committed as
static files), you cannot rebuild its JS/CSS/fonts. Attempt only the rows you
can change from this repo's server side: compression, cache headers, and the
HTML document itself when the template is in-repo. Skip every artifact-internal
row with a one-line reason. Hand-editing compiled output is not a keep.

### 2b. Then up to five of your own

When the checklist is exhausted, and only then, pick up to five hypotheses that
were **not** on the board, shaped by what profiling showed in this codebase.
Announce them as `[EXTRA] <n> follow-ups chosen: …`, then run them one at a
time under the same keep/revert rules. Fewer than five is fine when you are out
of honest ideas. Say so in `[DONE]` rather than padding the run.

### Keep or revert

- A **serious improvement** means the north star improved beyond the measured
  noise floor, AND by at least **5% or 20 ms**, whichever is larger for the
  metric's scale. An FCP-only win that **regresses LCP does not count**.
- Kept → `kept: true`.
- Anything else → **revert completely**, no half-kept experiments, and record
  `kept: false`. A revert costs only the iteration. Several in a row change
  nothing about what you do next.
- Report `[RESULT] <delta> — kept` or
  `[RESULT] <delta> — reverted, below the noise floor`.

### Every measurement is a row with numbers in it

Rewrite `results.json` the moment a `[TEST]` finishes, with:

- a **generic `name`** (never blank), `description`, `category`, `notes`;
- **`deltaMs` and `deltaPct`**, the north-star change against the previous kept
  state, negative when faster;
- **`measured`**, the absolute medians per mode, same shape as `baseline`;
- **`kept`**, `true` or `false`, never absent.

On a keep, also refresh `results.final` for the modes you measured.

Never append a row with no numbers. A miss is a row too. A skip is not a row.
Keep the file valid JSON at all times.

## Naming an improvement

`name`, `category` and `description` describe a **generic technique** that
could apply to any site. Site-specific detail (files touched, byte counts, why
you reverted) goes in `notes`.

None of the three generic fields may contain product or component proper nouns,
file or module names, byte sizes, versions or counts, CSS classes, route or API
paths, process footnotes such as `(second attempt)`, or changelog voice
(`Added…`, `Removed…`). Write a technique in the present tense as an
instruction to the next site.

| bad (one repo)                                | good (generic technique)  |
| --------------------------------------------- | ------------------------- |
| `Lazy-load Chat Side-pane Components`         | `Lazy-load components`    |
| `Lazy-load Hidden 262KB Changelog Rocket.gif` | `Lazy-load unseen images` |
| `Playfair Display 4 Weights → 1`              | `Reduce font payload`     |
| `Remove Duplicate 1MB Basic_examples Fetch`   | `Skip redundant fetches`  |

Prefer an existing checklist category name whenever one fits, and reuse its
description. Do not invent a category per component type. `Lazy-load the
Settings Modal` and `Lazy-load the JSON Editor` are one technique. Leave
`category` as `null` when nothing fits and you cannot phrase a generic name.

## Step 3 — the stop rule

Stop when **both** halves are done:

1. every checklist category has been tried or skipped, in rank order, and
2. your extras are done: budget spent, or no honest hypothesis left.

Then set `stoppedReason: "checklist-complete"`. Set `"user"` whenever the user
asks you to stop.

**There is no miss limit and no run count that ends the session.** Do not stop
at five measurements, do not stop on a streak of reverts, do not cut the
checklist short to get to your own ideas, and do not skip a category to save
time.

Before you exit:

1. Run one final full measurement pass (cold + warm) and write it to
   `results.final`.
2. If the kept changes are on a branch you can push and the user asked for a
   PR, open one with the measured deltas in the description and put its URL in
   `site.prUrl`. Do not open one otherwise.
3. Set `stoppedReason`, make sure every iteration is recorded, and report
   `[DONE] <one sentence>` with the keep count and the baseline-to-final
   north-star delta.

## Discipline

- Measure first. A change you cannot measure is a change you revert.
- One change per iteration. Entangled changes teach nothing.
- Numbers decide, not vibes. "It should be faster" is not a keep.
- Do not merge lab harnesses, profiling scripts, or rejected experiments into
  the site. Keep them in `.makefaster/` or delete them.
- Reject known traps: preloading grid thumbnails, `fetchpriority` washes,
  caching error responses, `srcset` rungs bigger than the CSS slot.
- Copy the _shape_ of known wins, not the file names. The measured technique
  catalog at [jjcm/speedupskill](https://github.com/jjcm/speedupskill) is worth
  reading when picking extras.

## `results.json` schema

All times are milliseconds. Deltas are negative when the site got faster.

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
  "final": {
    "cold": { "lcpMs": 1750, "ttiMs": 3050, "fcpMs": 1150, "tbtMs": 190, "cls": 0.03, "score": 91 },
    "warm": { "lcpMs": 780, "ttiMs": 1240, "fcpMs": 420, "tbtMs": 70 }
  },
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
    },
    {
      "n": 2,
      "name": "Preload LCP image",
      "description": "Preload the image the largest contentful paint waits on",
      "category": "Preload LCP Image",
      "notes": "Preloaded the first 8 grid thumbnails; LCP regressed, reverted",
      "phase": "checklist",
      "measured": { "cold": { "lcpMs": 2290, "ttiMs": 3750 } },
      "deltaMs": 150,
      "deltaPct": 7.0,
      "kept": false
    }
  ],
  "stoppedReason": "checklist-complete"
}
```

Field notes:

- `site` is optional. `site.url` is the bare domain if the repo makes it
  obvious. `site.prUrl` only when a PR was opened.
- `baseline` / `final` are medians per mode. `lcpMs` and `ttiMs` are required
  per included mode. `fcpMs`, `tbtMs`, `cls`, `score` are welcome extras.
  `final` is re-measured after the last kept change and again before exit.
- `iterations[].measured` is required on every measured iteration, kept or
  reverted. `deltaMs` / `deltaPct` compare the median to the previous kept
  state.
- `iterations[].phase` is `"checklist"` or `"extra"`, so a session that
  stopped early cannot read as a finished one.
- `stoppedReason` is `"checklist-complete"`, `"user"`, or `null` while running.
