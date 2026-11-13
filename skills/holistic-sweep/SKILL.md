---
name: holistic-sweep
description: "Run a repo-wide consistency sweep (design-system bypasses, tokens, animation, SSR, lint debt, dead code) as an orchestrator: exhaustive grep-first inventory as an attachment, proposed PR split, one Ship With Proof child per PR, leftover rescan, and a lint guard. Use for 'do a sweep', 'do a holistic audit', 'audit the whole repo for X', 'plan a child session sweep', or a code scan whose findings span many files."
metadata:
  version: 1.3.1
---

# Holistic sweep

Fix one class of problem everywhere, not the reported instance. This session orchestrates (inventory, split, children, rescan) and writes no fixes. Below the caller mode's delegation threshold (e.g. [**solar-mode**](../solar-mode/SKILL.md) `## Delegation`) it writes every fix itself instead, rescan leftovers included, one Ship With Proof PR per PR in the split, skipping steps 5 and 6; the `Not converted` section, inventory, split, rescan, and lint guard still apply.

Principles:

- [**principle-fix-root-causes**](../principle-fix-root-causes/SKILL.md): one report becomes a search for every site.
- [**principle-redesign-from-first-principles**](../principle-redesign-from-first-principles/SKILL.md): move each site to the primitive and delete the local copy or legacy wrapper (local `Badge`/`Pill`/`Chip`, pre-DS form-field wrappers); never restyle the duplicate.
- [**principle-build-the-lever**](../principle-build-the-lever/SKILL.md): rerunnable scanner script, codemods for mechanical changes, a lint rule at the end.

## Procedure

1. **Scope and scan.** State the target class in one sentence and list every signal (DS sweep: raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<hr>`, `<kbd>`, `<details>`, `Loader2`/`animate-spin`, `animate-pulse`, pill class strings, `role="button"`, clickable `<div>`/`<a>`, local `Badge`/`Pill`/`Chip`/`Spinner`/`EmptyState`/`Modal`/`Tabs` definitions, imports that skip the DS). A code scan or [`find-animation-opportunities`](../find-animation-opportunities/SKILL.md) may seed the list, never replace the inventory: scans sample.
2. **Enumerate exhaustively.** The scanner greps every tracked file in every project, package, and service, including `.ts`, CSS, MDX, and HTML. Classify every match as a **finding** (with its replacement primitive) or an **exception** (one-line reason: hidden file input, chart-library tooltip, list-row hit area, email HTML). Report files scanned, categories covered, and blind spots; a partial-directory or partial-filetype scan is incomplete.
3. **Inventory is the contract.** Attach the per-category, per-file report with line numbers and the scanner path. Every child gets it; the rescan diffs against it. Summarize as a `diff` (unmarked exists, `+` found, `-` missing) or a category list with file counts.
4. **Propose the split.** One PR per replacement primitive or category, about 20 to 40 files, large categories split by project or package. Mark each PR independent or dependent. A PR needing a design or product decision goes last, naming the decision. Offer a fewer-PRs variant merging named categories, then stop until the caller picks the count.
   - Stack only when the PRs must stack and the caller's mode allows it (solar-mode: only when asked; otherwise plain PRs in merge order): one linear [`gh-stack`](../gh-stack/SKILL.md), fixes first, lint guard on top.
   - Findings a script plus a quick read settles (auditing lint flags, validating dead code) are settled here, without children.
5. **Spawn one child per PR.** First reconcile file lists: a file in several categories goes to one child or is serialized as stack layers, so concurrent children never share a file. Each prompt is self-contained:
   - the inventory attachment and the child's exact files and line references;
   - the target primitive and the exceptions to leave, with reasons;
   - `@skills:ship-with-proof` (or the Ship With Proof playbook);
   - a required `Not converted` PR-body section listing every inventoried site deliberately left, with a reason;
   - its base: latest main if independent, the parent layer's branch head if a stack layer;
   - its file list as a hard scope.
6. **Orchestrate.** Keep one tracking table (category, PR link, files, state), posted on every state change. A caller requirement change for all children (e.g. "screenshots in both light and dark") goes to every child, plus a PR fixing the shared skill. An unreachable surface (e.g. needs a nonexistent TOTP secret) gets `not measured (<reason>)` and doesn't block the sweep. An idle child that reported is done. Relay cross-child facts yourself; siblings can't message each other.
7. **Rescan.** Once PRs are open or merged, pull main and rerun the scanner on main, every independent open PR head, and each stack's top layer (judge stacked files only there). A site is fixed only when its match is gone or a PR lists it under `Not converted` with a reason. Bucket the original findings: fixed on main, fixed only in open PRs, local component kept but now renders the primitive, left on purpose, not covered. Classify every new match, including new sites in known categories, as finding or exception; add new findings to the inventory and the uncovered bucket unless main, an independent head, or a top layer fixes them. List categories the inventory never checked. Uncovered sites, judgment calls included, go to one more Ship With Proof child.
8. **Lock it in.** A lint rule (an oxlint `jsPlugin`, an ESLint rule, or a repo rule with a per-file baseline), plus `DESIGN.md`, `AGENTS.md`, or agent-skill updates that make agents reach for the primitive first.

## Done means

- The inventory is attached, comes from a committed or attached scanner, covers the whole repo, and states scope and blind spots.
- Every inventoried site is fixed, in an open PR, or in a `Not converted` list with a reason.
- Every child PR meets Ship With Proof's "Done means" and is unmerged unless the caller asked for a merge.
- The rescan of main, independent PR heads, and stack tops shows zero uncovered findings.
- A lint guard is merged or open at the top of the stack. If the rescan or the guard is missing, say why.
