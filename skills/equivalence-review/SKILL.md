---
name: equivalence-review
description: "Review a PR only for unintended breakage, with proof. Ignores code quality and style. Use for 'equivalence review', 'is this non-breaking', 'safe to merge?'."
---

# Equivalence review

A PR passes if it moves toward its stated goal and breaks nothing it didn't mean to, with proof. Nothing else counts. Don't comment on quality, style, naming, slop, conventions, or better designs, not even as nits.

## Steps

1. **Intent.** From the PR description, ticket, and commits, state what it's meant to change. A refactor, move, or migration means strict equivalence.
2. **Behavior changes.** For everything observable outside the diff (callers, return/error paths, API and schema shapes, DB reads/writes, wire formats, flags/defaults, side effects, UI output, exports), compare old vs new. Follow changed symbols past the diff. Label each change intended, unintended, or unclear (treat unclear as unintended).
3. **Prove it.** The claims the PR's safety depends on need executed proof: a test, typecheck, or script that would fail if the claim were wrong. Ideally, run the same input on base and head and diff the output. Other claims need at least a `file:line`. If you can't prove a claim, mark it unproven. Never pass off a guess as proof.

## Output

The reader should get the answer from the first line and the evidence from a glance at one table. Write it as a scannable report, not paragraphs. Use the fixed order below, keep each cell to one line, and leave out empty sections.

### 1. Verdict line

One line, nothing before it:

```markdown
## ✅ Pass · ⚠️ Pass, pending proof · ❌ Fail
```

Pick one. Follow with one line: `**Intent:** <what the PR is meant to change> → <strict equivalence | intended change in X>`.

### 2. Scoreboard

One row per observable surface (or per PR in a stack). This table is the review; everything below supports a row in it.

```markdown
| Surface | What was compared | Base vs head | Proof |
|---|---|---|---|
| GCS upload/download/copy | 6 calls, 10 HTTP requests, logs | ✅ identical | differential harness |
| KMS encrypt/decrypt | 5 cases × 3 envs | ✅ identical | differential harness |
| Workers `fetch` binding | method call on `deps` | ⚠️ unproven | — |
| Error message on 404 | `ERR` text | ❌ changed | `file.ts:42` |
```

Status vocabulary, nothing else: `✅ identical`, `🟦 intended`, `❌ changed`, `⚠️ unproven`. Proof column names the kind (`differential harness`, `typecheck`, `test`, `blob hash`, `file:line`).

### 3. Unintended changes (only if any)

One block per change. Show the old → new shape as a `diff` block matched to what changed (wire payload, call tree, return value, file layout), then repro and fix:

````markdown
**`client.ts:88` – 404 now returns `ERR` instead of `ok(null)`**

```diff
 getItem('missing')
-  → ok(null)
+  → err('HTTP 404: …')
```

Repro: `<command>` · Fix: `<one line>`
````

### 4. Intended changes

Show the shape change visually, smallest view that makes it clear:

- API or call-shape change → `diff` of the call site.
- Moves → `diff` of the file tree.
- Flow change → `diff` of the call tree, or Mermaid if several components interact.
- State machine change (phase union, `transition()`, reducer, lifecycle modes) → the [`statechart`](../statechart/SKILL.md) skill's `chart.mmd` of the new behavior, with the equivalence claims as INVARIANTs; a rule that breaks is a finding.

```diff
 packages/
-├── clients/gcp/storage.ts
+├── clients/gcs/storage.ts          # pure client, takes (config, deps)
+└── platform/service-clients/gcs.ts # env + logger wiring, old names
```

### 5. Proof

Table, one row per claim the verdict depends on. Claim in plain words; evidence is the command and its decisive output, or a `file:line`.

```markdown
| Claim | Evidence |
|---|---|
| Same requests and results for GCS | `diff base.json head.json` → no output (442 lines) |
| No new type errors | tsgo base 1,490 errors = head 1,490, `comm` → empty |
```

### 6. Unproven

Checklist, each item closable by one command:

```markdown
- [ ] Runs on workerd, not just Bun → `wrangler dev` + trigger cron once
```

### Visual extras

When a stack or a wide change makes the scoreboard dense (roughly 8+ rows or several PRs), also render it as one HTML page (`html_preview` then `html_render` in T3, else write and `open` a file): a status grid of surfaces × PRs, colored by the status vocabulary. Keep the markdown report as well; the page doesn't replace it.

Intended changes never fail a PR.
