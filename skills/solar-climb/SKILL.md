---
name: solar-climb
description: >-
  One Devin run of a hill climb on one benchmarkable metric: audit the harness, try one measured change at a time with keep-or-revert by benchmark-checklist, audit the win, and ship one PR. Each automation trigger starts a fresh session; GitHub marker PRs are the only state. Use when an automation starts a climb run, or for "/solar-climb", "a solar climb of X", or "a continuous hill climb".
metadata:
  version: 2.4.0
---

# solar-climb

A hill climb targets a number a harness in this session measures (bytes, milliseconds, a count). Hunts belong to [**solar-loop**](../solar-loop/SKILL.md).

One session is one run: baseline, audit, attempts, one PR, report. The climb's marker PRs are the only state: open, merged, or closed with their review and close reason.

The run is unattended, so never stop to ask: decide, state the assumption in the PR body and report, and continue.

## Inputs, from the automation prompt

- `climb`: kebab-case slug.
- The repo and the scope the climb may change.
- The metric: what is measured, unit, direction. It runs to plateau, with no goal number.
- PR-body dedupe marker, `<climb>-climb: <target>` unless named.
- Optional: a keep threshold, and hints (a harness command, a production gauge for picking and field checks).

Decide whatever the prompt leaves open (harness, runs per side, keep threshold, regression tolerance, picker) and write it in the PR body's `## Method`. Reuse the `## Method` of the newest open or merged marker PR unless this run's audit proves it wrong; a run that changes it says why.

## Run

1. **Read GitHub.** List the climb's marker PRs. Open ones claim their targets. Merged ones carry their method and measurements. Closed unmerged ones carry a rejected mechanism, never retried on that target. With 3 or more open, ship nothing: report `capped` with each PR's review and CI state. Never adopt, rebase or babysit an earlier PR; the PR watchdog routes its blockers.
2. **Baseline.** Fresh clone, clean `origin/main`. Write the decision before running: the result that would change it and the noise floor ([**benchmark-checklist**](../benchmark-checklist/SKILL.md)). Measure `main`: two identical clean runs for a deterministic metric, at least 5 alternating runs per side for timing, compared by median.
3. **Audit the harness** (below).
4. **Profile and pick.** Rank targets from the harness breakdown or the production gauge by size times reach, skipping claimed targets and targets merged within 14 days. Profile the top one and name its limiter, the resource or code path that bounds it, from a profile or counters mapped to source.
5. **Attempt**, one change at a time on `devin/<timestamp>-<climb>-<target-slug>`, each a hypothesis naming one mechanism grounded in the limiter. Keep only when the delta clears the keep threshold (at least twice the run-to-run range, and worth a reviewer's time), nothing else regresses past tolerance, error and work counts match `main`, and the limiter explains the delta. Otherwise revert it in full and never retry it. Log each attempt: hypothesis, change, before, after, delta, verdict.
6. **Push past the first plateau.** After 3 reverted attempts, name the assumption they share, drop it, and take a larger step: another category, a combination of near misses, or the next target. Stop at the first kept change or after 6 attempts; with nothing kept, ship the unblocker per [**solar-loop**](../solar-loop/SKILL.md#every-run-ships). Its audit and PR body prove the rerun of the blocked step in place of a kept delta.
7. **Audit the win** (below), then ship through [**ship-with-proof**](../ship-with-proof/SKILL.md), ready for review, to the repository's required approval and green CI in this run. PR body: marker, baseline and candidate as median and range with run counts and measured SHAs, limiter, mechanism in one sentence, the production gauge that field-checks it when the prompt names one, `## Method`, `## Audit`, and the attempt log. When a review fix touches the measured path, re-measure the new head; close a PR whose head no longer clears the threshold, with the measurement.
8. **Report.**

## Audit

A number is a claim, and a claim survives only when a run proves it ([**principle-prove-it-works**](../principle-prove-it-works/SKILL.md)). Every run audits and drops what fails.

**The harness, before the first attempt:**

- **Sensitivity.** Plant a known regression on a scratch branch (extra bytes, a sleep on the measured path) and confirm the harness reports it at the expected size. A harness that misses it measures something else: fix it first.
- **Field agreement.** Where the prompt names a production gauge, the harness runs the same work the gauge times, shown by matching steps and work counts; the two numbers may differ by statistic or machine. A harness that skips or caches that work measures something else: repairing it is this run's PR.
- **Benchmark-checklist.** Answer all seven questions with evidence from this run's output, including error and work counts.
- **Earlier claims.** Re-measure on current `main` what the newest merged marker PRs claimed. A win that is gone is a regression and the first target. A baseline someone else's change moved is noted, never credited.

**The win, before shipping:**

- **Re-measure fresh.** Both sides from clean checkouts of the final SHAs, alternating, at the full run count.
- **Rule out the cheap explanations** (benchmark-checklist "explain the number"): errors, skipped or cached work, code that never ran, a feature removed, a check weakened, noise, a change too small to matter end to end. Show each one false with evidence.
- **Independent refutation.** A fresh subagent or child session that did not write the change gets only the claims, the diff and the harness, and tries to break each claim with a run, per [**interrogate**](../interrogate/SKILL.md). Fix what it proves or drop the win. Your own review, passing tests and CI are not this verdict.

Write the result as the PR body's `## Audit` table and the report's audit section: claim, command, output quoted, verdict (`held` or `dropped`).

## Plateau

When the newest 3 marker PRs closed unmerged below the threshold, none merged within 14 days, and this run keeps nothing, report `plateaued`: the limiter nothing moved, the total delta since the first marker PR, and tell the owner to disable the automation or redirect the climb.

## Report

First line: `<climb> — <kept: target delta (base → head), PR link | unblocker: what it unblocks, PR link | reverted: target, best delta vs threshold | capped: N open PRs | plateaued>`. Then:

- Audit: each claim, its command and verdict; anything dropped and why.
- This run: target, limiter, the attempt log, measurements with run counts and range.
- Merged marker PRs re-measured, on their production gauge where the PR names one.
- Open climb PRs with review and CI state.
- Next three targets, and what was not measured and why.

## Automation

Create with **solar-loop**'s procedure; `max_concurrent_runs` 1 and `max_queue_depth` 0, so a running run absorbs the next trigger. Prompt, each line only when the run couldn't decide it:

```md
@skills:solar-climb climb `<climb>` in @<owner>/<repo>.
Metric: <what is measured>, <unit>, <down|up>.
Scope: <paths or packages>; <what must stay the same>.
Marker: `<climb>-climb: <target>`.
Keep threshold: <rule, when it differs from step 5>.
Hints: harness `<command>`; production gauge `<query>`.
```

## Rules

- One target and one PR per run, never merged, enqueued or set to auto-merge.
- Removing a feature, skipping work or weakening a check is not an improvement.
- The harness and threshold never change to keep a candidate.
- Measurement output is never committed.
