---
name: green-stack
description: >-
  Get a PR stack merge-ready bottom-up: repair conflicts, fix required CI and blocking review findings, report what remains. Delegates stack mechanics to the installed stack-management skill; never queues or merges. Use for "green the stack" or "restack".
metadata:
  version: 2.4.0
---

# Green stack

Resume each layer's [completion checklist](../ship-with-proof/SKILL.md#completion-checklist); recheck it after restacking.

## Stack tools

Load the repo's stack-manager skill (e.g. `$gh-stack`) for commands, linking, restacking and recovery. A managed stack stays in its own tool. Reproduce a failed check with the job's own command on the layer that owns the code. Handle findings through the repo's review workflow.

## Bottom-up

1. Inspect the live stack: bottom, parents, heads, checks, review blockers. One worker per branch; preserve unrelated local work.
2. Bring each layer onto its updated parent, keeping the existing history strategy unless there's a reason to change it (your call if delegated). Resolve each conflict on the owning layer and propagate upward. Verify parent ancestry and each layer's diff. Once mergeable, stop chasing unrelated trunk changes.
3. Repair ancestry before optional per-layer local checks; run repo-required verification and focused tests for real fixes. Read failed CI logs before changing heads: fix regressions in the owning layer, retry infra failures only after diagnosis, report shared or optional failures separately. A missing or pending required check is not passing.
4. Fix blocking review findings in their owning layers and propagate. Apply the repo's actual approval rules: a changed SHA alone needs no new review-bot approval; request review when a required approval is missing or a substantive change needs one, not after a mechanical restack. Human sign-off stays human.
5. Refresh every open layer. Run independent stacks in parallel, one worker and worktree each, branch names unique per worktree. Retry fetch and push on transient network or ref-lock errors. Keep a short handoff: heads, unfinished work, review-request links. After an interrupted command or worker, inspect what landed before retrying; diagnose a repeat failure instead of restarting.

## Restack recipes

- **Squash-merged parent.** Merging trunk into the child gives false conflicts. Merge the parent's final head into the child, merge the squash commit's first parent, record the squash with `git merge -s ours <squash>`, then merge trunk. Every file differing from the squash must be one the child changes. Use the stack manager's equivalent if it has one.
- **Mechanical restack.** No logic change needs only the cheap gates per layer: lockfile and reference sync, frozen-lockfile install, typecheck. CI runs the full suite on all layers in parallel.
- **Reproducing CI.** Clear stale incremental output (`tsbuildinfo`, `dist`) first, and test the PR merged with its base, as CI does. Changed-file lint pulls pre-existing debt into scope once a move or rename touches a file.
- **Generated layer.** When a codemod or bulk-move layer conflicts in the hundreds, rerun its codemod on the repaired parent, reapply its follow-up commits, and keep history with `git merge -s ours <old head>`, never a force-push.
- **Move-layer conflict.** Take the parent's file and reapply this layer's renames. Three-way merge manifests and config (`package.json`, tsconfig), never one whole side.

## Reviews and waits

- Use the installed review skill for message format and reviewer identity. Before declaring Slack unavailable, check for a connected integration that posts as the human, Executor included.
- Reuse an outstanding review request. A standing GitHub team request isn't evidence the review bot is reviewing the current changes: track the actual ask and verdict, separately from human-review requests.
- Wait on host PR notifications, not sleeps or polling, and fix what's actionable meanwhile. Stop watches when handing back or when the user calls the stack done; a later queued notification doesn't reopen the task.

## Done

Green means correct parent relationships, every open layer mergeable, required checks satisfied, required approvals and blocking threads addressed. Existing approvals count if the repo accepts them; add no latest-head approval gate.

Report **Green** or **Not green** with a per-layer summary: each PR's full URL, remaining blockers, optional failures, unverified behavior, the fixes and verification that matter, and that nothing was queued or merged. When blocked on a human or an unavailable service, name it and stop looping.
