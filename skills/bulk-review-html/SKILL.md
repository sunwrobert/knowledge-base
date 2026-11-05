---
name: bulk-review-html
description: Present a batch of related pull requests as one single-page review, numbered fixes with a PR citation and a trimmed diff each, then render it to one full-page PNG for sharing. Use when a sweep produces many small PRs (capability gaps, parameter drift, adapter alignment) and someone wants them read together. Companion to code-diagram-html, which explains one change in depth.
---

# Bulk review HTML

One HTML file, one PNG. Each fix is a numbered section with a short description, a PR link in the margin, and the decisive hunk of the diff. The page is generated from a JSON spec so the prose and excerpts are reviewable as data and the layout stays identical across batches.

Generated pages and PNGs are deliverables, not source. Write them outside any repo (for example `~/bulk-review/<slug>.html`) and attach them to the thread. Do not commit them.

## Workflow

1. **Collect the PRs.** Use `gh pr view <n> --json title,body,state,author,mergedAt` for titles, bodies and state. Fetch each head locally to diff the real code:
   ```bash
   git fetch origin pull/<n>/head:pr-<n>
   git diff -U2 $(git merge-base origin/<default-branch> pr-<n>) pr-<n> -- <path>
   ```
2. **Write the spec** at `~/bulk-review/<slug>.json`. Field meanings are in the `scripts/build.py` docstring, a complete example is in `references/spec-example.json`. Per fix:
   - `title`: a noun phrase, not the commit subject.
   - `description`: two or three sentences. What was wrong, what the upstream accepts, what changes. Inline `<code>` for parameter names. No file paths in prose.
   - `diff`: the one hunk (or two short hunks) that carries the fix, from the source file, not the tests. Keep `@@` headers so line numbers render. Drop imports and unrelated context.
   - `tags`: `package · area` for the margin.
   - `wire` (adapter and transform changes): one or more before/after pairs of the payload that changes, either the request sent upstream or the response returned to the caller. Give each a `label` naming the direction and target, for example `Upstream request · <provider API>`. Keep payloads to the fields that matter and elide the rest with `[ ... ]`. Derive them from the code and the upstream docs, not from guesswork. Skip `wire` for fixes that do not change what goes over the wire.
3. **Build and render.**
   ```bash
   python3 <skill>/scripts/build.py ~/bulk-review/<slug>.json ~/bulk-review/<slug>.html
   python3 <skill>/scripts/render-to-png.py "file://$HOME/bulk-review/<slug>.html" ~/bulk-review/<slug>.png
   ```
   The renderer needs the `playwright` Python package (`pip3 install --user playwright` if the import fails). It connects to `CDP_ENDPOINT` when set, else launches the Chrome at `CHROME`, else Playwright's bundled Chromium (`playwright install chromium`).
4. **Inspect the PNG** before sending. Crop the top, middle and bottom with Pillow and look at them. Check that no diff line is clipped, that line numbers do not wrap, and that citations sit in the margin.
5. **Deliver** the HTML and PNG as attachments.

## Rules

- `description` and `footer` are inserted as HTML so `<code>` works. Only build specs you wrote or reviewed. Everything else is escaped.
- Descriptions come from the PR body and the diff, not the commit subject alone. If they disagree, trust the diff.
- Do not state a PR is merged unless `gh pr view` says so.
- Diff excerpts are verbatim. Trim lines, do not rewrite them.
- Wire payloads are illustrative and must match what the code emits. If a case was rejected before being sent, say so in `before`.
- Order fixes by theme, not by PR number.
- Byline is the PR author and the date of the newest commit in the batch.

## Style

Neutral by default: off-white background, near-black text and code panels, one blue accent for ordinals and PR chips, a teal secondary for wire panels, green and red for diff rows. When the repository has design tokens (or a [`viz`](../viz/SKILL.md) palette is in use), replace the `:root` variables at the top of `CSS` in `scripts/build.py` with them; do not hand-style elsewhere. Inter is embedded from `references/Inter-subset.woff2` (Latin subset, OFL, license in `references/Inter-OFL.txt`) so the page has no network requests. Do not add a CDN font.

## Gotchas

- Long diff lines wrap inside the code panel. If a hunk wraps more than a couple of lines, pick a shorter hunk or trim trailing context.
- `\ No newline at end of file` markers render as a dim metadata row and do not advance line numbers.
- The page is roughly 1,100 to 1,300 PNG pixels per fix at 2x. Past about fifteen fixes, split the batch into two pages.
- Tests: `python3 scripts/build_test.py`.
