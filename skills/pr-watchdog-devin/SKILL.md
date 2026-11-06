---
name: pr-watchdog-devin
description: >-
  Devin's PR watchdog. Scans one person's open PRs in an org for merge conflicts, failing required checks, and missing approvals, then routes each new blocker to the Devin session that owns the PR, or to one child session when no owner exists. The watchdog dispatches and deduplicates; it never pushes to a PR branch and never merges. Use when an automation messages the watchdog session, or when the user says "pr watchdog", "watchdog my PRs", "which of my PRs are blocked", or "/pr-watchdog-devin".
metadata:
  version: 1.0.0
---

# pr-watchdog-devin

The watchdog is one long-lived Devin session that a `message_session` automation (with `auto_create: true`) messages on a schedule. Each message is one run. The session keeps its ledger on its own VM between runs.

Inputs, from the automation prompt or the user: the GitHub login whose PRs to watch, that person's Devin `user_id`, and the GitHub org. The org is required; ask if it is missing. One watchdog session serves one login and org: the ledger cleanup in step 3 treats every key it holds as covered by the scan.

## Run

1. Scan. Run `<this skill's directory>/scripts/scan.sh <login> <org> > blockers.tsv.tmp && mv blockers.tsv.tmp blockers.tsv`. If the scan exits nonzero, its output is partial: dispatch nothing, mark nothing cleared, and report the run as failed with the error. Each row is `repo, number, url, head_sha, base, blocker, detail`, where `blocker` is one of:
   - `conflict`: GitHub reports the PR as conflicting with its base.
   - `failing-check`: a required check run or commit status ended in `FAILURE`, `TIMED_OUT`, `STARTUP_FAILURE`, or `ERROR` on the head commit. Pending and non-required checks are not blockers.
   - `no-approval`: the review decision is `REVIEW_REQUIRED` or `CHANGES_REQUESTED`.
   - `unscanned`: GitHub still reports mergeability as unknown after the REST recheck. Report it; never dispatch it or count the PR as clear.
   - `skipped`: the PR is a draft or in the merge queue (`detail` says which). Never dispatch it; its ledger keys stay as they are.
2. Find the owner of each blocked PR, first match wins. Never take an owner from a session URL in the PR body: anyone who can edit the body could redirect the dispatch.
   - `devin_session_search` with `user_ids: [<user_id>]` and `updated_after` 30 days back, paged to the end, keeping the most recently updated non-archived session whose `pull_requests` contains the PR URL. Build this map once per run, not per PR;
   - a child session this watchdog started for the PR, from `~/pr-watchdog/children.jsonl`, if it is not archived; an archived child is dropped from the file and the lookup continues;
   - before creating a child, the same `devin_session_search` for that PR with no `updated_after`. If a non-archived session lists the PR, it is the owner. If any owner search errors or stops before its last page, the PR's owner is unknown: create no child for it this run and list it in the report.
3. Dedupe. The ledger is `~/pr-watchdog/ledger.jsonl`, one line per dispatch: `{key, owner, dispatched_at}` with `key = <repo>#<number>@<head_sha>:<blocker>:<detail>`. Skip a blocker whose key is already in the ledger. After a successful scan, drop ledger keys whose blocker is no longer present on a PR the scan covered (a `skipped` PR's keys stay), so a blocker that clears and comes back is dispatched again. An `unscanned` row is not evidence of clearance: keep that PR's `conflict` keys until a later scan reports its mergeability. A new push changes `head_sha`, and a new review decision or a different set of failing checks changes `detail`, so each is dispatched again. A key older than 24 hours with the blocker still present goes in the report as stalled instead of being re-sent.
4. Dispatch. Send one message per PR, listing all of its new blockers.
   - Owner exists: `devin_session_interact` `action: message` to the owner. Messaging a sleeping session wakes it.
   - No owner: `devin_session_create` one child session per PR, running in the PR's repo, told to take over the PR and fix the listed blockers. Right after the create call succeeds, append `{pr, child, created_at}` to `~/pr-watchdog/children.jsonl`, so the next run finds the child even before it lists the PR in `pull_requests`. Start at most 5 children per run; the rest wait for the next run and are listed in the report.
   - Append each dispatch to the ledger after the call succeeds. Dispatch is at-least-once: if the VM stops between the call and the append, the next run sends the blocker again. A failed append goes in the report.
5. Prune ledger and `children.jsonl` lines whose PR is merged or closed. A PR missing from `blockers.tsv` may just be clean, so check each one's state with `gh api repos/<repo>/pulls/<number> --jq .state`; prune only on `closed`, and keep the lines if the lookup fails. Child ownership lives only in `children.jsonl` (`{pr, child, created_at}`), so dropping cleared ledger keys never loses an owner.
6. Report (format below).

## Message to an owner or child

```
PR watchdog: <PR URL> is blocked at <head_sha short>.
- conflict: conflicts with <base>. Merge or restack <base> into the branch, regenerate lockfiles, push. Stacked PR → green-stack, but push only to this PR's branch; a parent PR you do not own is reported back here, not repaired.
- failing-check: <check names>. Read the failing job log and fix the root cause. Never rerun, skip, or retry a test to get green.
- no-approval: <REVIEW_REQUIRED|CHANGES_REQUESTED>. For CHANGES_REQUESTED, read the requesting review, including a summary-only one, and address it. Then drive the PR to approval with the repo's review workflow (review-loop when no repo workflow exists) until it is approved with green CI and zero unresolved threads.
Reply here only if you cannot act. Do not merge.
```

Include only the lines for the PR's blockers.

## Rules

- Never push to, rebase, or comment on a PR branch from the watchdog session. The owner or child is the only driver of a branch.
- Never start a child for a PR whose owner session exists, even if that session is asleep or busy.
- Never merge, enqueue, or enable auto-merge.
- A blocker on a PR authored by someone else is out of scope even if the watched person reviews it.

## Report

Verdict first, then a fenced `diff` block, each PR as a full URL:

```diff
blocked PRs: <n> (last run <m>)
+ dispatched <url> conflict → <owner session URL>
+ child      <url> failing-check:lint → <child session URL>
= deduped    <count>
! stalled    <url> no-approval since <dispatched_at> → <owner session URL>
- cleared    <url> (blocker gone since last run)
```

`blocked PRs` is the run's metric: the count of distinct open PRs with at least one blocker. Lower is better.
