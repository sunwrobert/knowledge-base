---
name: holistic-sweep
description: "Run a repo-wide consistency sweep (design-system bypasses, design tokens, animation, SSR, lint debt, dead code) as an orchestrator session: an exhaustive grep-first inventory saved as an attachment, a proposed PR split, one Ship With Proof child session per PR, a rescan for leftovers, and a lint guard that stops the class from coming back. Use when asked to 'do a sweep', 'do a holistic audit', 'audit the whole repo for X', 'plan a child session sweep', or after a code scan whose findings need fixing across many files."
metadata:
  version: 1.0.0
---

# Holistic Sweep

A sweep fixes one class of problem everywhere it occurs, not just the instance someone noticed. This session is the orchestrator: it owns the inventory, the split, the child sessions, and the final rescan. It does not write the fixes itself.

## How to start one

A kickoff looks like this. Accept any subset, and fill in the rest from this skill.

```
/scan  (or "Help me set up a code scan")
<what to sweep for, e.g. raw HTML elements and one-off components that should use a DS component>
@skills:principle-fix-root-causes @skills:principle-redesign-from-first-principles @skills:principle-build-the-lever
Do a holistic audit and inventory every instance. Propose a split. One child session per PR, each with @skills:ship-with-proof.
```

The three principles each set a rule for the sweep:

- [**principle-fix-root-causes**](../principle-fix-root-causes/SKILL.md): fix the pattern, not the instance. One bug report becomes a search for every site that has the same pattern.
- [**principle-redesign-from-first-principles**](../principle-redesign-from-first-principles/SKILL.md): move each site to the primitive the system would have used from day one, and delete the local copy or legacy wrapper (for example local `Badge`/`Pill`/`Chip` components or pre-DS form-field wrappers). Restyling the duplicate does not count.
- [**principle-build-the-lever**](../principle-build-the-lever/SKILL.md): the inventory comes from a rerunnable scanner script, not a hand read. Fixes use codemods where the change is mechanical, and the sweep ends with a lint rule.

## Procedure

1. **Scope and scan.** Write down the target class in one sentence and list every concrete signal for it (for a DS sweep: each raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<hr>`, `<kbd>`, `<details>`, `Loader2`/`animate-spin`, `animate-pulse`, pill class strings, `role="button"`, clickable `<div>`/`<a>`, local `Badge`/`Pill`/`Chip`/`Spinner`/`EmptyState`/`Modal`/`Tabs` definitions, direct imports that skip the DS). A code scan or a skill such as [`find-animation-opportunities`](../find-animation-opportunities/SKILL.md) can seed the list, but it is never the inventory. Code scans sample and miss whole categories.
2. **Enumerate exhaustively.** Build the scanner as a script that greps every tracked file in the repo: every project, package, and service, plus `.ts`, CSS, MDX, and HTML, not just `.tsx` in the directories you expected. Classify every match as a **finding** (with the replacement primitive) or an **exception** (with a one-line reason, such as a hidden file input, chart-library tooltip, list-row hit area, or email HTML). Leave no bucket unresolved. In the report, state the files scanned, the categories covered, and the blind spots that remain. Never call a scan complete when it only covered some directories or file types.
3. **Save the inventory as the contract.** Attach the full per-category, per-file report with line numbers, and keep the scanner path next to it. The inventory carries the context for the whole sweep: every child gets it, and the rescan diffs against it. Summarize at top level in diff view (unmarked lines exist, `+` lines are found, `-` lines are missing) or as a short category list with file counts.
4. **Propose the split.** Make one PR per replacement primitive or category, at about 20 to 40 files each, so review and visual-regression runs stay manageable. Split large categories by project or package. Mark which PRs are independent (no stack needed) and which depend on another. Put any PR that needs a design or product decision last, and say what the decision is. Offer a fewer-PRs variant that merges named categories. Then stop and let the caller pick the count.
   - If the PRs must stack, use one linear [`gh-stack`](../gh-stack/SKILL.md): fixes first, the lint guard last at the top of the stack.
   - If a script plus a quick read can settle the findings (for example auditing lint flags or validating dead code), do it in this session and don't fan out.
5. **Spawn one child session per PR.** Each child prompt is self-contained and includes:
   - the inventory attachment and the child's exact file list and line references from it;
   - the target primitive, the exceptions it must leave alone, and their reasons;
   - `@skills:ship-with-proof`, which brings review approval, light and dark [`before-after-ss`](../before-after-ss/SKILL.md), and a recording;
   - a required `Not converted` section in the PR body listing every inventoried site the child deliberately left, each with a reason;
   - its starting point: latest main for an independent child, or the parent layer's branch head for a dependent stack layer.

   Before spawning, reconcile file lists across categories. One form often holds raw inputs, buttons, and a spinner, so the same file can land in several category PRs. Give overlapping files to one child, or serialize them as dependent stack layers. Concurrent children never edit each other's files.

6. **Orchestrate.** Keep one tracking table (category, PR link, files, state) and post it whenever its state changes. When the caller changes a requirement that applies to every child (for example "screenshots in both light and dark"), relay it to every child, and also open a PR that fixes the shared skill so the next sweep inherits it. When a surface can't be reached (for example a page that needs a credential that doesn't exist locally), have the child mark it `not measured (<reason>)` and move on. Don't let it block the whole sweep. A child that sits idle after reporting is done, not stuck. Children can't message their siblings, so relay any cross-child facts yourself.
7. **Rescan for leftovers.** Once the PRs are open or merged, pull main and rerun the same scanner on main, on the head of every independent open PR, and on the top layer of each stack. Judge stacked files only at the top layer, because lower layers come before what later layers add or reintroduce. A site counts as fixed only when its match is gone, or when the PR lists it under `Not converted` with a reason. A site a PR touched that still matches stays uncovered. Report the original findings in these buckets: fixed on main, fixed only in open PRs, local component kept but now renders the primitive, left on purpose, and not covered by any PR. Classify every new match too, including new sites in categories already inventoried, as a finding or an exception with a reason. Add new findings to the inventory and the uncovered bucket unless main, an independent PR head, or a stack's top layer already fixes them. List any new category the original inventory never checked. Fix the uncovered sites, judgment calls included, in one more Ship With Proof child.
8. **Lock it in.** End with a lint rule (an oxlint `jsPlugin`, an ESLint rule, or a repo rule with a per-file baseline) so new code can't bring the class back. Without a guard the class comes back. Also update `DESIGN.md`, `AGENTS.md`, or the skills that agents read, so they reach for the primitive first.

## Done means

- The inventory is attached, comes from a committed or attached scanner script, and covers the whole repo, with its scope and blind spots stated.
- Every inventoried site is fixed, is in an open PR, or sits in a PR's `Not converted` list with a reason.
- Every child PR satisfies Ship With Proof's "Done means" list and is unmerged unless the caller asked for a merge.
- The rescan of current main, independent open PR heads, and each stack's top layer shows zero uncovered findings.
- A lint guard for the class is merged or open at the top of the stack.

## Forbidden

- Do not treat a code scan's output, or a sample of files, as the inventory.
- Do not start child sessions before the caller has picked the split.
- Do not let a child widen its scope beyond its file list, or edit a concurrently running sibling's files.
- Do not restyle a local duplicate instead of replacing it with the primitive.
- Do not end the sweep without the rescan and the lint guard, or without saying why either one is missing.
