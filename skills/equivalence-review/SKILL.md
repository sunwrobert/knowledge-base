---
name: equivalence-review
description: "Review a PR only for unintended breakage, with proof; ignores quality and style. Use for 'equivalence review', 'is this non-breaking', 'safe to merge?'."
metadata:
  version: 1.1.0
---

# Equivalence review

A PR passes if it moves toward its stated goal and breaks nothing it didn't mean to, with proof. Make no comment on quality, style, naming, conventions, or alternative designs, nits included. Intended changes never fail a PR.

## Steps

1. **Intent.** From the description, ticket, and commits, state what it's meant to change. A refactor, move, or migration means strict equivalence.
2. **Behavior changes.** Diff old against new for everything observable outside the diff (callers, return and error paths, API and schema shapes, DB reads and writes, wire formats, flags and defaults, side effects, UI output, exports), following changed symbols past the diff. Label each intended, unintended, or unclear; unclear counts as unintended.
3. **Proof.** Every claim the verdict depends on needs an executed, falsifiable check (test, typecheck, script), ideally a differential run of one input on base and head. Other claims need at least a `file:line`. Anything else is unproven.

## Output

Verdict first, evidence in one table. One-line cells, this order, empty sections omitted.

### 1. Verdict line

```markdown
## ✅ Pass · ⚠️ Pass, pending proof · ❌ Fail
```

Pick one, then: `**Intent:** <what the PR is meant to change> → <strict equivalence | intended change in X>`.

### 2. Scoreboard

One row per observable surface (or per PR in a stack). Every later section supports a row.

```markdown
| Surface | What was compared | Base vs head | Proof |
|---|---|---|---|
| GCS upload/download/copy | 6 calls, 10 HTTP requests, logs | ✅ identical | differential harness |
| Workers `fetch` binding | method call on `deps` | ⚠️ unproven | — |
| Error message on 404 | `ERR` text | ❌ changed | `file.ts:42` |
```

Status vocabulary, nothing else: `✅ identical`, `🟦 intended`, `❌ changed`, `⚠️ unproven`. Proof names the kind (`differential harness`, `typecheck`, `test`, `blob hash`, `file:line`).

### 3. Unintended changes

One block per change: an old → new `diff` of what changed (wire payload, call tree, return value, file layout), then repro and fix:

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

Smallest view of the shape change:

- API or call shape → `diff` of the call site.
- Moves → `diff` of the file tree.
- Flow → `diff` of the call tree, or Mermaid when several components interact.
- State machine (phase union, `transition()`, reducer, lifecycle modes) → the [`statechart`](../statechart/SKILL.md) skill's `chart.mmd` of the new behavior, equivalence claims as INVARIANTs; a broken rule is a finding.

```diff
 packages/
-├── clients/gcp/storage.ts
+├── clients/gcs/storage.ts          # pure client, takes (config, deps)
+└── platform/service-clients/gcs.ts # env + logger wiring, old names
```

### 5. Proof

One row per claim the verdict depends on; evidence is the command and its decisive output, or a `file:line`.

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

When the scoreboard is dense (roughly 8+ rows or several PRs), also render one HTML page (`html_preview` then `html_render` in T3, else write and `open` a file): a surfaces × PRs grid colored by status. Keep the markdown report too.
