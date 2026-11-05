---
name: spotlight
description: Render the core hunks of a PR or a file range as clean editor-style code screenshots (2x PNG, VS Code Dark Modern colours, JetBrains Mono, breadcrumbs, line numbers, indent guides, removed/added overlay, highlighted lines, boxed tokens, one-line caption) and post them in the Slack thread or PR. Use when someone says "spotlight this PR", "!spotlight", "code screenshot of the change", or wants the most important lines of a diff shown as an image instead of a wall of diff.
metadata:
  version: 1.0.0
---

# Spotlight: code screenshots of what matters in a PR

One PNG per core behavioral change, never one per file or per hunk. A spotlight shows the lines a reviewer must read, with the removed lines inline so the before and after sit next to each other, and a caption that says what changed in plain words.

## Inputs

- A PR URL, commit, or branch, or a file path with a line range (a GitHub blob URL with `#L10-L20` works as shorthand).
- A git checkout of the repo (`--repo`). Fetch the PR's head or merge commit first so `--ref` resolves.
- Chrome or Chromium on `PATH` (or `CHROME=/path`), and ImageMagick `convert` for cropping (optional; without it the PNG keeps blank padding below the frame).
- One-time: `bun install --cwd <skill>/scripts`.

## Procedure

1. Pick the core changes. Read the PR description and the full diff, then name at most three behavioral changes. Test files, fixtures, comment rewrites, imports, and renames are context, not spotlights. If the PR has one real change, make one image.
2. Resolve refs. For a merged PR use the merge commit on the default branch as `--ref` and `<merge>^` as `--diff`. For an open PR use the head SHA as `--ref` and `$(git merge-base origin/<default-branch> <head>)` as `--diff`. Removed lines come from `git diff <diff> <ref> -- <file>`, so both must exist locally.
3. Choose ranges on the new side of the diff. Keep each image under about 25 lines: the enclosing function signature or declaration, the changed lines, and the few lines after them that make the expression complete. Join distant pieces (an import, a helper, its call site) with comma-separated ranges; the renderer draws a `⋯` gap between them.
4. Render one image per change:

   ```bash
   bun <skill>/scripts/render.ts \
     --repo <path/to/repo> --ref <merge-sha> --diff <merge-sha>^ \
     --file <path/in/repo.ts> --lines 20-29 \
     --crumbs "<enclosingFunction>" \
     --highlight 26,27 --mark <token> \
     --caption "Core change 1|<what a request or user now gets, in one sentence>." \
     --out /tmp/spotlight/<change>.png
   ```

   `--crumbs` names the enclosing symbols, `>`-separated. `--highlight` tints the lines that carry the change; `--mark` boxes the token that explains it (a flag, a new helper, a guard). `--caption` is `Label|sentence`; the sentence states the behavior, not the syntax. `--dedent` for deeply nested code; `--theme github-light` for a light variant.

5. Open every PNG and check it: the removed lines (red, `−`) sit directly above their replacements (green, `+`), no line is cut off at the right edge, the caption fits on one line, and the line numbers match the new file. Narrow the range or shorten the caption and re-render rather than shipping a clipped image.
6. Post. Lead with one line per image naming the file, symbol, and change, then attach the PNGs in that order. In Slack, reply in the thread that holds the PR link. Do not paste the diff text as well.

## Rules

- Line numbers and content come from git at `--ref`, never from a screenshot or memory. Re-render after every push.
- Never edit the source to make a nicer picture.
- Keep captions to one sentence with no code-ese: say what a request or user now gets, not which operator moved.
- Three images is the ceiling. More than that means the PR needs a diagram or a written summary instead.
