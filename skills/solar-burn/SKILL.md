---
name: solar-burn
description: >-
  One long-lived Devin session that owns a whole burn-down: a frozen inventory of instances of one class (flaky tests, migration call sites, untested modules, failure classes) driven to zero, one reviewable batch per tick, then a guard that keeps it at zero. A `message_session` automation with `auto_create: true` messages the session on a schedule; each message is one tick. The session keeps its mission, frozen inventory command, ledger and frontier on its own VM, rebuilds context from them every tick, and picks the next batch from what earlier ticks learned. Use when an automation messages a burn session, or when asked for "/solar-burn", "a burn on X", "burn down X", or "one session that keeps burning X".
metadata:
  version: 1.1.1
---

# solar-burn

A burn-down drives a count of instances of one class to zero: flaky tests, call sites of an old API, modules without property tests, failure classes in a CI queue. A number a harness benchmarks (bytes, milliseconds) is a hill climb instead; use [**solar-climb**](../solar-climb/SKILL.md). The shapes are defined in [**solar-loop**](../solar-loop/SKILL.md).

One session runs the burn for its whole life. The automation prompt names the burn and its class; everything else is decided by the session and written to disk, so a context summary or a VM restart loses nothing.

## Inputs, from the automation prompt

- `burn`: a kebab-case slug. State lives in `~/burn/<burn>/`.
- The repo and the scope the burn may change.
- The class: what one instance is, and what "burned" means for it.
- The dedupe marker for PR bodies, `<burn>-burn: <instance>` unless the prompt names one. A PR carries one marker line per instance in its batch, and the guard PR carries `<burn>-burn: guard`.
- Optional hints: a candidate inventory command or telemetry query, a batch size, a migration guide, rules the scope must keep.

## Inventory kinds

- **Static**: a command over the checkout (grep, AST query, lint rule in report mode, a coverage map). The count on `main` is exact, and a branch's count is its candidate.
- **Telemetry**: a query over CI or production history (test results, job logs, Datadog, a flaky-test report) with a frozen window, source and definition. New instances keep arriving, so the ledger counts inflow separately from burned instances, and a burned instance is only `settled` once it stays absent for a full window after merge.

## State

All in `~/burn/<burn>/`. The burn works only in its own clone, `~/burn/<burn>/repo`, created on the first tick; it never edits another checkout. Read every file at the start of each tick; never rely on chat history.

- `mission.md`: the inputs as given, then the decisions frozen on the first tick: the inventory command or query plus the content hash of any script it runs, its window and source for telemetry, the definition of an instance and of burned, the proof each instance needs, batch size, picker, the guard to add at zero, and the first count (value and `main` SHA or window end), which never changes. Changed only by the inventory-change rule below.
- `inventory.json`: the latest inventory, one entry per instance with an id, location and the evidence that counts it (for telemetry: failing runs, SHAs, error lines).
- `ledger.jsonl`: one line per instance attempted, `{tick, at, instance, root_cause, mechanism, proof, verdict, pr, pr_state, field}`, and one line per tick, `{tick, at, count, inflow, verdict}`. Instance `verdict` is `burned`, `unreproduced`, `reverted` (fix failed its proof), `invalid` (the inventory or proof run itself errored) `reopened` (a settled instance came back) or `guard` (the zero-count guard PR). Tick `verdict` is `shipped`, `capped`, `empty`, `zero` or `guarded`. `pr_state` is `open`, `merged-pending-field`, `settled` or `rejected`.
- `frontier.md`: remaining instances ranked by the picker, with evidence, plus root causes already found per instance and mechanisms rejected and why. Rewritten every tick.
- `harness/`: any inventory or proof script the burn wrote itself, outside the clone so cleanup never deletes it.

## First tick: freeze the mission

1. Clone the repo to `~/burn/<burn>/repo`. Find or write the inventory: the prompt's hint, the repo's own report, or a script in `harness/`.
2. Prove it counts the same way twice: two runs on the same `main` SHA, or the same closed telemetry window, give an identical list.
3. Check it counts real instances: inspect a sample of at least 5 by hand (all of them when there are fewer), plus every instance near an exclusion rule. Fix false positives and misses in the inventory now, not later.
4. Freeze the proof each instance needs. A static instance is burned when it leaves the inventory on the branch, converted the same way as the already-migrated ones. A telemetry instance needs a reproduction on `main` and a passing proof on the branch under the same conditions (for flaky tests: the failure reproduced by repeat or stress runs on `main`, then the same repeat count passing on the branch).
5. Set the batch so one PR stays reviewable (`at most 10 call sites`, `one flaky test or one shared root cause`), the picker (highest failure rate or traffic first, leaf before shared), and the guard to add at zero (a lint rule, a test, a CI check).
6. Write `mission.md`, `inventory.json`, an empty ledger, and the first `frontier.md`. Then continue with a normal tick.

## Every tick

1. Sync. Read the state files. List the burn's marker PRs (open, and merged or closed since the last tick) before touching the clone. In `~/burn/<burn>/repo`, fetch `main`; a burn branch that has a PR and unpushed work reruns its frozen proof first, and is pushed only if the proof passes (otherwise the work is discarded and logged `invalid`); then check out `main` whatever branch the clone is on and reset it to `origin/main` (the clone is the burn's own, so local `main` holds nothing else). A burn branch (`devin/*-<burn>-*`), committed or not, with no ledger line and no PR is an interrupted attempt: log its instances as `invalid` and discard it. Dirty state on any other branch was not made by the burn: stop and report it, never discard it.
2. Settle earlier PRs. First adopt any open PR in the burn's repo whose body carries the marker, whose branch matches `devin/*-<burn>-*` and whose author is the burn's owner, but which has no ledger line: add its instances with `pr_state` `open`, rerun their proof on its head, and finish its unfinished ship-with-proof gates. Adopt the same way a matching marker PR with no ledger line that merged or closed since the last tick, then settle it as below. A marker PR that fails those checks is a foreign claim: skip its instances, leave the PR alone, and list it in the report; one open 14 days with no new commit is reported as stale so the owner can close it or release the instance. For each ledger PR whose `pr_state` is `open` or `merged-pending-field`, read it with `gh pr view`. Merged, static: `settled` once the instances are absent from `main`'s inventory, counted by a complete, error-free run of a script whose hash matches `mission.md` (on an error, partial result or mismatch the PR stays as it is until step 4's check passes). Merged, telemetry: `merged-pending-field` until a full window after the merge passes; then query the whole interval from the merge to now (not the rolling window ending now, which may have aged out early failures), and `settled` once that interval spans at least one window and the fixed code ran in it (for flaky tests: the test ran on SHAs containing the merge) with the instance absent, counting only post-merge failures: on a SHA that contains the merge or, for a source with no commit SHA on its events, from an emitting service version that contains it, and attribution unknown (never a reopen) when the event's version cannot be established (a late run on older code is not evidence against the fix); a field query that errors, times out or returns partial results keeps `merged-pending-field` and logs `invalid`; with no such run yet it stays `merged-pending-field` and the next tick queries the longer interval, otherwise append `reopened` with the new evidence, release the PR's `merged-pending-field` hold, and put the instance back on the frontier with the failed mechanism rejected. A `settled` instance is also `reopened` when it comes back: for a static burn, its id reappears in a later inventory; for a telemetry burn, a later inventory has a post-merge failure for it; its pre-merge-only occurrences are kept in `inventory.json` as stale and left out of `count`, never counted as inflow. Closed unmerged: `rejected`, with the review reason in `frontier.md`.
3. Cap. If 3 or more burn PRs are open and unmerged, ship nothing: drive the open ones through the repository's required review in this session with ship-with-proof's own review loop ([**review-loop**](../review-loop/SKILL.md)), never a separate babysit session, then report.
4. Re-inventory on current `main` (or the window ending now) with the frozen command. First compare the content hash of any repo-owned script it runs with the one in `mission.md`; a mismatch goes through Inventory changes before any count is trusted, and makes the tick `invalid` unless that section accepts the edit as equivalent. If the command errors, times out or returns incomplete results, keep the previous `inventory.json`, append a tick line with verdict `invalid`, and report; an errored run is never zero. Record `count` and `inflow` (instances new since last tick) on the tick line. At zero, go to Zero, unless a `reopened` instance is not yet burned and settled again: an unclaimed one is picked in step 5; when every one is held by an open or `merged-pending-field` PR, report `empty` and wait, even though the rolling window no longer counts them.
5. Pick one batch: the top of `frontier.md` after re-ranking, skipping instances claimed by an open PR's marker or held by a `merged-pending-field` PR, and skipping a mechanism the ledger already rejected for that instance. Instances with one root cause are one batch.
6. Find the root cause before editing. For a telemetry instance, reproduce it on `main` first. Name the root cause and exactly one mechanism per instance.
7. Fix on branch `devin/<timestamp>-<burn>-<instance-slug>` from `main`, and run the frozen proof. Keep only when every instance in the batch passes it. For a static burn the inventory on the branch, counted with `main`'s copy of any inventory script, must also drop by exactly the batch, with no new instances. A telemetry inventory reads history, so the branch cannot change it: the instances stay counted until the field window settles them.
8. Not kept: revert and append `reverted` with what failed. An instance that would not reproduce after the frozen proof's full effort gets `unreproduced` with what was tried; it stays on the frontier ranked below reproducible ones, and the report names it once it has two `unreproduced` lines. Try at most one more batch, then report.
9. Kept: ship through [**ship-with-proof**](../ship-with-proof/SKILL.md). Append the `burned` lines with the PR URL and `pr_state` `open` as soon as the PR opens. The PR body carries one marker line per instance, `remaining: <N> → <M>`, each instance's root cause and mechanism in one sentence, the reproduction on `main` and the proof on the head, and the field check. When a review or proof fix touches a burned instance, rerun its proof on the new head; one that no longer passes leaves the PR, goes back to the frontier with `reverted`, and a PR left with no instance is closed with `rejected`. One PR per tick. Never merge.
10. Rewrite `frontier.md`: root causes found, shared causes that group remaining instances, and the next batch.
11. Report.

PR watchdog or reviewer messages about a burn PR arriving between ticks are handled when they arrive, on that PR's branch, before the next tick starts.

## Inventory changes

The inventory changes only when a tick shows it is wrong: it counts something that is not an instance, misses instances, or the repo moved what it scans. A script edit that leaves what it matches unchanged (formatting, comments, renames; the query, filters and paths are identical) only updates the hash in `mission.md` once both versions give identical output on the same `main` SHA or window, and the tick proceeds; any other edit goes through this procedure. Otherwise record the reason and the old and new commands in `mission.md` and a tick line with verdict `invalid`, re-run first-tick steps 2 and 3, and re-count. Never change the inventory, the window, or the definition of burned to shrink the count.

## Zero

At count zero with no open burn PR, no instance still `merged-pending-field`, no `reopened` instance not yet burned and settled again, and no `guarded` tick line whose guard PR merged, add the guard from `mission.md` in one PR through ship-with-proof (the lint rule, test or CI check that fails when a new instance appears, and removal of any shim the migration kept alive), and append a ledger line for it with instance `guard`. When that PR merges, append the tick line `guarded` with its merge SHA; a guard PR closed unmerged gets `rejected` and the next zero tick retries it. Once guarded, a zero tick only re-inventories and reports. For a static burn, report `zero` and tell the owner to disable the automation. For a telemetry burn, inflow never stops: later ticks keep re-inventorying, burn any new instance as a normal tick, and report `zero` with the inflow; tell the owner they can lower the schedule frequency.

## Report

First line: `<burn> — remaining <N> → <M> (inflow <K>) | <shipped: instances, PR link | capped: N open PRs | empty | zero | guarded>`. Then:

- Cumulative: first count → current count, burned and settled totals, reopened count, ticks left at the current rate.
- This tick: each instance with its root cause, mechanism and proof.
- Field checks read this tick for merged PRs.
- Open burn PRs with review and CI state.
- The next batch from the frontier, and any instance with two `unreproduced` lines.

## Automation

Create it with **solar-loop**'s procedure (schemas, validate, approval-gated create), with these cells overriding its settings table: action `message_session` with `auto_create: true`; `max_concurrent_runs` 1 and `max_queue_depth` 0, so a tick still running absorbs the next trigger; `devin_mode` `fusion`; name `<Class> Burn-down — <repo>`. The prompt is short:

```md
Run one solar-burn tick with @skills:solar-burn for burn `<burn>` in @<owner>/<repo>.
Class: <what one instance is>; burned means <definition>.
Scope: <paths or packages>; <rules the scope must keep>.
Marker: `<burn>-burn: <instance>`.
Hints: inventory `<command or query>`; batch <size>.
```

## Rules

- One batch and one PR per tick.
- An instance is burned by removing its cause. A retry, skip, quarantine, timeout bump, wider assertion, or deleted test burns nothing.
- Never merge, enqueue, or enable auto-merge.
- Never commit inventory output or state files.
