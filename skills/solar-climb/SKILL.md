---
name: solar-climb
description: >-
  One long-lived Devin session that owns a whole hill climb on one benchmarkable metric and ships one measured PR per tick until the metric plateaus. A `message_session` automation with `auto_create: true` messages the session on a schedule; each message is one tick. The session keeps its mission, frozen harness, ledger and frontier on its own VM, rebuilds context from them every tick, picks the next target from what earlier ticks learned, and keeps or reverts by benchmark-checklist. Use when an automation messages a climb session, or when asked for "/solar-climb", "a solar climb of X", "one session that keeps climbing X", or "a continuous hill climb".
metadata:
  version: 1.0.0
---

# solar-climb

A hill climb is a loop on a number a harness in this session can measure: bytes, milliseconds, a count. A metric without such a harness (a test count, a migration count, a telemetry hunt) is not a climb; those are burn-downs or hunts; use [**solar-loop**](../solar-loop/SKILL.md) for those.

One session runs the climb for its whole life. The automation prompt names the climb and its metric; everything else is decided by the session and written to disk, so a context summary or a VM restart loses nothing.

## Inputs, from the automation prompt

- `climb`: a kebab-case slug. State lives in `~/climb/<climb>/`.
- The repo and the scope the climb may change.
- The metric: what is measured, its unit and direction. No goal number: the climb runs until it plateaus.
- The dedupe marker for PR bodies, `<climb>-climb: <target>` unless the prompt names one.
- Optional hints: a candidate harness command, a production gauge for target picking and field checks, rules the scope must keep (never drop a feature, findings must stay identical).

## State

All in `~/climb/<climb>/`. The climb works only in its own clone, `~/climb/<climb>/repo`, created on the first tick; it never edits another checkout. Read every file at the start of each tick; never rely on chat history.

- `mission.md`: the inputs as given, then the decisions frozen on the first tick: harness commands plus the content hash of each measurement script they run (the scripts that time, count or report, not the code under test), the benchmark-checklist answers that vetted it, run count per side, noise range, keep threshold, regression tolerance, target picker, field check, and the first baseline (value, unit, `main` SHA), which never changes. Changed only by the harness-change rule below.
- `ledger.jsonl`: one line per attempt, `{tick, at, target, mechanism, limiter, base, head, delta, range, verdict, pr, pr_state, field}`, and one line per tick that made no attempt. `verdict` is `kept`, `reverted` (valid measurement that missed the threshold or regressed), `invalid` (a run that errored or did no work), `capped`, `empty` (no eligible target), `plateaued` or `resumed`. `head` carries the measured commit SHA. `pr_state` is `open`, `merged-pending-field`, `settled` or `rejected`. `field` is filled by a later tick.
- `frontier.md`: ranked candidate targets with the evidence behind each, plus mechanisms already rejected per target and why. Rewritten every tick.
- `baseline/`: the latest `main` measurement output, with its commit SHA.
- `harness/`: any measurement script the climb wrote itself, outside the clone so cleanup never deletes it.

## First tick: freeze the mission

1. Clone the repo to `~/climb/<climb>/repo`. Find or write the harness: use the prompt's hint or the repo's own measurement script, and put a script you write in `harness/`; read it per benchmark-checklist "Before you run anything".
2. Vet it with [**benchmark-checklist**](../benchmark-checklist/SKILL.md), answering all seven questions with evidence from runs on `main`. Make it print error and work counts, so later ticks check questions 4 and 7 from its output.
3. Measure noise: at least 5 runs on `main`. A deterministic metric (bundle bytes, file counts) proves it by two clean runs with identical output, and from then on one run per side is enough. A timing metric keeps 5 alternating runs per side on every tick.
4. Set the keep threshold to at least twice the observed run-to-run range, and no lower than the smallest change worth a reviewer's time. Set the regression tolerance for everything else the harness reports.
5. Choose the target picker: the harness's own breakdown, a production gauge, or both, ranked by size times reach.
6. Write `mission.md`, an empty ledger, and the first `frontier.md`. Then continue with a normal tick.

## Every tick

1. Sync. Read the state files. In `~/climb/<climb>/repo`, fetch `main` and check out clean `main` whatever branch the clone is on. A climb branch (`devin/*-<climb>-*`), committed or not, with no ledger line and no PR is an interrupted attempt: log its target and mechanism as `invalid` and discard it. Dirty state on any other branch was not made by the climb: stop and report it, never discard it.
2. Settle earlier PRs. First adopt any open PR in the climb's repo whose body carries the marker, whose branch matches `devin/*-<climb>-*` and whose author is the climb's owner, but which has no ledger line: add it with `pr_state` `open`, re-measure its head with the frozen harness, and finish its unfinished ship-with-proof gates before treating it as a normal open climb PR. A marker PR that fails those checks is a foreign claim: skip its target and leave the PR alone. For each ledger PR whose `pr_state` is `open` or `merged-pending-field`, read it with `gh pr view`. Merged with no field check in `mission.md`: set `settled`. Merged with a field check: read it once a production deploy contains the merge commit, record it in `field` and set `settled`; until then set `merged-pending-field` and re-read next tick. Closed unmerged: set `rejected` and mark its target rejected in `frontier.md` with the review reason.
3. Cap. If 3 or more climb PRs are open and unmerged, ship nothing: drive the open ones through the repository's required review ([**review-loop**](../review-loop/SKILL.md), with the climb's repo in place of any default repo), then report. The climb does not outrun review.
4. Re-baseline on current `main` with the frozen harness. If the ledger shows a plateau (see Plateau), report it and stop here. A baseline that moved since last tick because of someone else's change is noted in the report, not credited to the climb.
5. Pick one target: the top of `frontier.md` after re-ranking with the new baseline, skipping targets claimed by an open PR's marker or merged within 14 days, and skipping a mechanism the ledger already rejected for that target. Profile before editing (benchmark-checklist question 1) and name the limiter and exactly one mechanism.
6. Change one thing on branch `devin/<timestamp>-<climb>-<target-slug>` from `main`.
7. Measure the candidate with the frozen harness, the same runs per side as `mission.md`, alternating sides for timing metrics. Keep only when the delta clears the keep threshold, nothing else regresses past tolerance, error and work counts match, and the limiter explains the delta (benchmark-checklist questions 3 to 7).
8. Not kept: revert. If the base side errored or did no work, append an `invalid` line and leave the mechanism untried; repair the harness only when the harness-change rule applies (the harness is wrong or the measured code moved), and when `main` itself is broken, report that as the blocker without touching the harness. If only the candidate errored or did no work, the change broke the measured work: append a `reverted` line with the error, so the mechanism counts as rejected. Otherwise append a `reverted` line. Try at most one more mechanism, then report. A tick that ends at the cap or with no eligible target appends a `capped` or `empty` line.
9. Kept: ship through [**ship-with-proof**](../ship-with-proof/SKILL.md). Append the `kept` line with the PR URL and `pr_state` `open` as soon as the PR opens. The PR body carries the marker, baseline and candidate as median and range with run counts and the measured SHA, the limiter, the mechanism in one sentence, and the field check. When a review or proof fix after that touches the measured path, rerun the frozen harness on the new head and update the PR body and the ledger line; a head that no longer clears the keep threshold gets its PR closed, its ledger line set to `reverted` with `pr_state` `rejected`, and its target marked rejected in `frontier.md`; the checkout then returns to clean `main`. One PR per tick. Never merge.
10. Rewrite `frontier.md`: what this tick's profile revealed, the new limiter, and next candidates.
11. Report.

PR watchdog or reviewer messages about a climb PR arriving between ticks are handled when they arrive, on that PR's branch, before the next tick starts.

## Harness changes

The harness changes only when a tick shows it is wrong: a benchmark-checklist question fails (it measured a cache, missed errors, timed work that never ran), or the repo moved the measured code. Re-vet the new harness, re-measure noise and threshold, record the reason and the old and new commands in `mission.md` and a ledger line with verdict `invalid`, and re-baseline. Never change the harness or lower the threshold to keep a candidate. A candidate that edits a hashed measurement script is measured with `main`'s copy of it; edits to the code under test, including build scripts the harness invokes, are measured as the candidate.

## Plateau

After 3 consecutive ticks with no `kept` line, counted by `tick` in the ledger (`capped` ticks, and ticks whose only lines are `invalid`, do not count), the climb has plateaued. Report `plateaued`, the limiter no mechanism moved, the total delta since the first baseline in `mission.md`, and tell the owner to disable the automation or redirect the climb to a new metric. Append a `plateaued` line with the baseline at that moment. Further ticks repeat the plateau report and open nothing until the owner changes the mission or `main`'s baseline moves past the keep threshold from that recorded value; then append a `resumed` line, and plateau counting restarts after it.

## Report

First line: `<climb> — <kept: target delta (base → head), PR link | reverted: target, best delta vs threshold | capped: N open PRs | plateaued>`. Then:

- Cumulative: first baseline → current `main`, with tick count and kept count.
- This tick: the target, limiter, mechanism, measurements with run counts and range.
- Field checks read this tick for merged PRs.
- Open climb PRs with review and CI state.
- The next three frontier targets.
- What was not measured and why.

## Automation

Create it with **solar-loop**'s procedure (schemas, validate, approval-gated create), with these cells overriding its settings table: action `message_session` with `auto_create: true`; `max_concurrent_runs` 1 and `max_queue_depth` 0, so a tick still running absorbs the next trigger; `devin_mode` `fusion`; name `<Metric> Climb — <repo>`. The prompt is short:

```md
Run one solar-climb tick with @skills:solar-climb for climb `<climb>` in @<owner>/<repo>.
Metric: <what is measured>, <unit>, <down|up>.
Scope: <paths or packages>; <rules the scope must keep>.
Marker: `<climb>-climb: <target>`.
Hints: harness `<command>`; production gauge `<query>`.
```

## Rules

- One target and one PR per tick.
- A metric moved by removing a feature, skipping work, or weakening a check is not an improvement.
- Never merge, enqueue, or enable auto-merge.
- Never commit measurement output or state files.
