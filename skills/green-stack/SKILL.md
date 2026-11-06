---
name: green-stack
description: >-
  Get a PR stack merge-ready, bottom-up: repair conflicts, fix required CI and blocking review findings, and report what remains. Use for "green the stack", "fix the stack", or "restack". Delegate stack mechanics to the installed stack-management skill. Does not queue or merge PRs.
metadata:
  version: 2.1.0
---

# Green Stack

Get every open layer merge-ready without unnecessary rewrites or review cycles. Queueing and merging stay with the user.

## Use the stack's tools

Load the installed skill for the repository's stack manager, such as GitHub's [`gh-stack`](../gh-stack/SKILL.md). Let it handle commands, flags, linking, restacking and recovery. Keep an existing managed stack in its own tool rather than converting it to another manager.

For a failed check, read the failing job's log and reproduce it with the job's own command on the layer that owns the code; use the repository's review workflow for findings. This skill coordinates the work, not the mechanics.

## Work bottom-up

1. Inspect the live stack, checkout and open PRs. Establish the current bottom, parent relationships, heads, checks and review blockers. Coordinate ownership so two workers do not push the same branches; preserve unrelated local work.
2. Bring each layer onto its updated parent, bottom-up. Follow the stack manager's normal workflow and preserve the existing history strategy unless there is a reason to change it. If the user delegates that choice, make it and continue. Resolve conflicts on the owning layer and propagate fixes upward. Verify parent ancestry and each layer's diff. Avoid chasing unrelated trunk changes once the stack is mergeable and repository requirements are met.
3. Complete the ancestry repair before adding expensive optional local checks between every layer. Follow repository-required verification, and use focused tests for actual fixes. Inspect failed CI logs before changing heads: fix branch regressions in the owning layer, retry infrastructure failures only after diagnosis, and report shared or optional failures separately. A required check that is missing or pending is not passing.
4. Address blocking review findings in their owning layers, then propagate any fixes. Use the repository's actual approval requirements. Do not demand another review-bot approval just because a SHA changed. Ask for review when required approval is missing or a substantive change needs review, not after every mechanical restack. Human sign-off remains a human requirement.
5. Refresh every open layer after the repairs. Run independent stacks in parallel, one worker and worktree each, with branch names unique to that worktree. Retry fetch and push on transient network or ref-lock errors. Do not block on sleeps. If blockers remain, continue fixing what is actionable; use host PR notifications for CI or review waits and resume when they arrive. Keep a short handoff with heads, unfinished work and review-request links. After an interrupted command or worker failure, inspect what actually landed before retrying. Diagnose repeated failures instead of repeatedly restarting workers.

## Restack recipes

- **Squash-merged parent.** Merging trunk into the child after a squash-merge yields false conflicts, because trunk does not contain the parent's commits. Merge the parent's final head into the child, merge the squash commit's first parent, record the squash with `git merge -s ours <squash>`, then merge trunk. Check that every file differing from the squash is one the child itself changes. Use the stack manager's equivalent if it has one.
- **Mechanical restacks.** A restack with no logic change needs only the repository's cheap gates per layer: lockfile and reference sync, frozen-lockfile install, and a typecheck. Let CI run the full suite on all layers in parallel; do not run a full local verify between layers.
- **Reproduce CI exactly.** Before trusting a local pass, clear stale incremental build output (`tsbuildinfo`, `dist`). Check the PR merged with its base, which is what CI checks out. Changed-file lint pulls pre-existing debt into scope once a move or rename touches a file.
- **Generated layers.** When a layer is a codemod or bulk move and its parent merge conflicts in the hundreds, rerun the layer's codemod on the repaired parent instead of hand-merging. Then reapply its follow-up commits and keep history with `git merge -s ours <old head>`, never a force-push.
- **Conflicts in a move layer.** Take the parent's file and reapply this layer's renames to it. Merge manifests and config (`package.json`, tsconfig) three-way. Never take one whole side, which silently drops exports or dependencies.

## Reviews and waits

Use [`review-loop`](../review-loop/SKILL.md) or the repository's review workflow for the request format and reviewer identity. When review requests go through a chat channel, discover a connected integration that posts as the human before declaring the channel unavailable.

Reuse an outstanding review request rather than spamming. A standing team review request is not evidence that the review bot is reviewing the current changes. Track the actual ask and verdict; keep human-review requests separate.

Prefer host watches over polling loops. Stop watches when handing work back or when the user says the stack is done. A queued notification after that is not a reason to reopen the task or request more reviews.

## Done

Green means the stack's parent relationships are correct, all open layers are mergeable, required checks are satisfied, and repository-required approvals and blocking review threads are addressed. Existing approvals count when the repository still accepts them; there is no extra latest-head approval gate.

Report **Green** or **Not green**, with a compact per-layer summary that gives every PR's full URL of remaining blockers and any optional failures or unverified behavior. Include the fixes and verification that matter, and state that nothing was queued or merged. When blocked on a human or unavailable service, name that blocker rather than continuing an unproductive loop.
