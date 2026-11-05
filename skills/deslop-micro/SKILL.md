---
name: deslop-micro
description: Review a PR or branch for invented terminology, misleading names, duplicated helpers or literals, stale comments, and unnecessary indirection. Use after a code-quality review to inventory every new name and make a behavior-preserving cleanup, or to report findings in review mode.
metadata:
  version: 1.0.0
---

# Deslop Micro

Review a PR or branch written mostly by an agent. Naming is the primary target. Map new terms back to concepts the repository already uses rather than adding synonyms. Read the change as a whole before examining individual diff hunks.

## Inputs

- PR URL or branch name.
- Mode: `review` posts findings only. `fix` makes a cleanup commit on the branch. Default to `fix` on a branch owned by this session, otherwise `review`.
- Any terms the requester considers established, even if new to the repository.

## Procedure

1. **Read the layout.** Check out the branch, run `git diff --merge-base origin/main --stat`, and build a tree of added and renamed paths. Record any path whose purpose is not apparent from its name.
2. **Read the change.** Read entry points, exported functions, schemas, and files named in the PR description before the core leaves and utilities they call. Write a two-sentence plain-language summary. If the layout and code do not support one, record the structure as a finding before reading diff hunks.
3. **Inventory helpers.** For every new function, class, or utility in the diff, search the repository for equivalent behavior by its verb and noun using `rg`. Read the nearest package's entry point, helpers, and utilities, plus shared helpers. Record `new helper | file | existing equivalent and search | verdict`. Use `replace with existing` for an equivalent, `extend existing` when the existing helper is one parameter short, and `keep` only when nothing already does the job.
4. **Inventory names.** Extract every new exported symbol, type, schema and field, enum member, constant, database column, file, directory, log field, and metric name. Record `name | kind | file | existing concept it maps to | verdict`. Include every new name, even those that look fine.
5. **Inventory literals.** For each new string or number constant, set, map key, or comparison from a closed vocabulary such as statuses, modes, kinds, outcomes, or error codes, use `rg` to find the canonical definition across the repository, including other languages in the same service. Record `literal | file | canonical definition and search | verdict`. Use `use enum` when one exists, `add enum and use it` when multiple sites spell out the same vocabulary with no canonical definition, and `keep` only for a one-off value with no shared vocabulary. When the definition is in another language, include a parity test that reads the other source and compares the value sets.
6. **Judge every name.** Apply these tests in order and record the replacement beside each non-`keep` verdict:
   - Tangible concept: search its noun outside the diff with `rg`. If absent and not standard domain vocabulary, rename it to an existing concept or delete it.
   - Existing name: if the repository uses another name for the same concept, rename the synonym to the established term.
   - Predicate scope: inspect every comparison or filter using the name and list the values or conditions it admits. If the name is broader or narrower than that set, rename it to the exact predicate it gates. Add one terse comment for a non-obvious exclusion.
   - Readability: if knowing what it holds requires more than one read, rename it. Only a name passing all four tests gets `keep`. Mark requester-approved terms `keep` with `accepted by requester`.
7. **Judge structure.** For each function with more than two conditional or callback nesting levels, flatten using returns, `continue`, or a named function. Inline pass-through wrappers, helpers, classes, or files. Apply helper and literal inventory remedies to duplicate abstractions. Remove new fields, options, parameters, and types with no reader in the diff. Record each remedy.
8. **Judge comments.** Check every new comment or docblock and the docblock enclosing changed code. Verify referenced symbols exist, the text describes current behavior rather than the diff or old behavior, and a reader without the PR can understand it. Record `location | stale name / old behavior / describes diff / unclear | rewrite / delete`. Record any non-obvious exclusion, ordering dependency, or purpose-specific status missing a terse contract comment.
9. **Apply conventions.** Use `AGENTS.md`, the nearest `REVIEW.md`, and the nearest package's `AGENTS.md` to settle ambiguous findings. Cite the applicable rule next to each finding instead of applying personal taste.
10. **Deliver review mode.** Post one PR comment with the plain-language summary, helper, name, and literal inventories limited to non-`keep` rows, followed by comment and structure findings. State each current name, replacement or deletion, and reason in one line. Do not post a nit unsupported by the inventories or fixed checks.
11. **Deliver fix mode.** Apply every non-`keep` verdict and comment or structure remedy in one commit titled `refactor: remove invented terminology and flatten <area>`. Preserve behavior and use an existing term or the exact predicate for any replacement name. If there are no findings, make no commit and no comment.
12. **Validate.** Run the repository's documented verification command and scoped tests for the touched packages. Re-run steps 3 through 8 on the resulting diff. The final inventory must contain only `keep` verdicts and no comment findings. Edit tests only to update renamed identifiers or add the cross-language parity test, never to make changed behavior pass.
13. **Report.** In `review` mode, the comment is the deliverable. In `fix` mode, post a PR comment with the before/after name table and the reason for each rename, alongside the cleanup commit. No comment is needed if there were zero findings.

## Boundaries

- Do not invent a term to replace a bad one, change the values admitted by a set to fit its name, rewrite algorithms, or change behavior.
- Do not post findings for code outside the PR. A structural issue requiring a design change belongs in the separate [`thermo-nuclear-code-quality-review`](../thermo-nuclear-code-quality-review/SKILL.md) skill rather than this local cleanup.
- Schema and database column names have the highest migration cost. Review them before variable names.
