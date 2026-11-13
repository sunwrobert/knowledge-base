---
name: sync-kb
description: Port upstream changes from OpenRouterTeam/agent-plugins into the skills that already live in sunwrobert/knowledge-base, keeping them company-neutral. Use for "/sync-kb", "update my solar mode to kb", "sync kb", or "update my skills onto kb".
metadata:
  version: 1.0.0
---

# sync-kb

`sunwrobert/knowledge-base` holds company-neutral ports of personal skills whose working copies live in `OpenRouterTeam/agent-plugins`. This skill moves upstream changes into the ports.

## Scope

- Only skills already in `skills/` here. A skill absent from this repo does not belong; never add one unasked.
- Skip skills with `metadata.github-repo` in their frontmatter. They are pinned installs; refresh them with `gh skill install` at a new pin.

## Procedure

1. Work in a fresh worktree of this repo from `origin/main`.
2. Run `scripts/drift.sh`. It prints the upstream diff, since the commit in `base`, for each in-scope skill.
3. Apply each hunk to the port by hand as a three-way merge: take the upstream change, keep the port's neutral wording. Never copy an upstream file over a port.
4. Neutralize what upstream adds:
   - Employer names, repos, channels, bots and internal skills become the generic term the port already uses (the review bot is "the repository's required review", routed to `review-loop`).
   - A link to a skill outside this repo is dropped or reworded; `bun run validate` fails on a plugin skill linking outside its plugin.
   - Agent-specific content (Devin tools and settings) goes in `references/<agent>.md`, as upstream does.
5. Match the upstream `metadata.version` on each ported skill.
6. Write the upstream HEAD SHA that `drift.sh` printed into `base`.
7. Run `bun run validate`, format the changed skills, and grep them for employer names: zero hits.
8. Open one PR listing each skill's version change and every upstream hunk left out, with its reason.
