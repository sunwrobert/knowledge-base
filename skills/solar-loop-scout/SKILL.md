---
name: solar-loop-scout
description: >-
  Find loop opportunities, recurring bounded measurable work a solar-loop automation could own, by mining a person's Devin sessions, PRs and Slack or a team's OKRs, Linear and channels, triangulating each signal across two sources, and ranking candidates with metric, recurrence evidence, overlap, and a /solar-loop mission sentence. Use for "/solar-loop-scout", "loop scout", "what should I automate", "find loop opportunities for <team or person>", "what do I keep doing by hand", "what could be a hunt", or before creating a batch of automations.
metadata:
  version: 1.5.0
---

# solar-loop-scout

Every OKR metric is already a reward function; the scout's job is finding the metrics with the cheapest verifier. Output is a ranked list; [solar-loop](../solar-loop/SKILL.md) turns one candidate into an automation.

## Inputs

Ask only for what the request doesn't imply; otherwise decide and state the assumption in the report.

- The target: one person (handle, Devin user id, Slack user id) or one team (Linear team or projects, Slack channels, OKR page).
- The window: default 60 days in three 20-day slices.
- The repos the target works in, so inventories can be counted.
- Candidate count: default top 5, the rest in an appendix.

## Sources

A candidate ranks only with evidence from at least two sources.

Person mode:

- Devin sessions the person started, per slice, clustered by surface. Drop automation runs (already loops) and child sessions (one task). Read two or three sessions per cluster for what it actually asked.
- The dedupe set: every enabled automation, Oncall responder and scheduled code scan, by any creator, whose name, prompt, repos or channels touch the target's surfaces. A teammate's automation owns a surface as fully as the target's.
- Slack messages from the person, per slice, one friction keyword per search (`again`, `every`, `manual`, `flaky`, `slow`, `migrate`, `remind`, `automate`, their repo names). A dominant channel is itself a signal.
- Their merged and open PRs, per slice; titles that repeat across slices (`fix flaky`, `bump`, `migrate`, `remove`) are candidates.
- Skills they authored and knowledge notes naming them: a codified workflow with no schedule is a loop waiting for one.

Team mode:

- OKRs: the quarter's goal pages in Notion and Linear initiatives; every success metric with a baseline, target and source is a climbable metric.
- Linear issues by team since the window start, bucketed into slices and clustered by label and title. Reopened or repeating issues are a backlog a loop drains.
- Team Slack channels per slice: complaint threads, alert noise, "someone should", "every release", "again", unanswered bot posts.
- Alert and CI channels the team owns: volume per alert name per slice, bots included.
- Datadog monitors and dashboards tagged to the team, and any metric the OKR page cites as its source.

## Mining

Run the three slices as parallel subagents when volume warrants. Slices partition the window. Each returns `signal → evidence pointers`, each pointer with source, stable id (session id, PR number, Slack ts, issue identifier) and date; dedupe by id across slices before counting.

Loop signals:

- Repetition: the same verb and surface in two or more slices (fix flaky X, bump Y, re-review Z, migrate W, triage channel V).
- Manual cadence: something done weekly or daily by hand, or a reminder to do it.
- An inventory that only shrinks by hand: imports of a deprecated module, old-API call sites, files outside the design system, tests on a legacy runner, `TODO(migrate)` markers.
- A watched number: a dashboard checked across sessions, an OKR metric with a source, a CI duration, an error rate, a bundle size.
- Branches on a hardcoded identity (provider enum, model-name switch, per-customer flag) where the object could carry the data.
- Shotgun surgery: a change touching many files the same way each time; files per instance is the metric, one config entry the target.
- Unanswered alerts: bot posts outnumber human replies.
- Named friction: "again", "every time", "why does this keep", "someone should", "can we automate".

Triangulate: one slice from one source is weak (appendix); two slices or two sources make a candidate; three make it strong. Count distinct records, not queries.

## Qualification

All five must hold; a failure goes under "not a loop" with the failing test.

- Recurs, at a rate the evidence shows.
- Bounded: one session finishes a unit (one fix, one batch, one queue drain) with no mid-run human decision.
- Measurable per the [solar-loop metric contract](../solar-loop/SKILL.md#metric-contract): a production number with a direction, or an inventory count to zero, from a freezable command. Name the harness or inventory command and, with the repo available, run it once for today's value.
- Verifiable before merge. A code-changing loop's verifier measures the branch in the session (inventory count, bundle size, a passing test, a local production build measurement, a replayed production sample). A post-deploy production gauge (p75, error rate) is the field check; a production-only metric is listed `needs verifier`, unranked, until a branch-level proxy is named (synthetic Lighthouse on a local production build for LCP, a replayed error sample for an error rate, a timed local run for CI duration). An ops loop's verifier is the queue count read in the session. Human judgment is not a verifier.
- Unowned: nothing in the dedupe set, by any creator, covers the surface (enabled automation, Oncall responder, scheduled scan, scheduled skill). An existing unscheduled skill is the fastest candidate: the loop just calls it.

## Ranking

Score qualified candidates 1 to 3 on four axes, sort by sum, break ties toward lower first-run cost.

- Recurrence: how often the evidence shows it returning.
- Pain: human time or production impact per recurrence, from evidence.
- Measurability: 3 if the branch-level verifier is frozen or is the inventory command; 2 if a proxy is named and runs in one session but isn't vetted; 1 if the proxy dominates a run (a production build per measurement).
- Readiness: 3 if a skill or playbook does the unit of work; 2 if a recipe exists in sessions or docs; 1 if the mechanism is unknown.

## Report

Lead with `solar-loop-scout — <target>, <window>: N candidates, top: <one line>`. Then one block per ranked candidate:

```text
<rank>. <Name> — <shape: hill climb | audit | telemetry hunt | ops loop>
   metric: <number, unit, direction, or "remaining <instances> → 0">
   today: <value from running the harness or inventory command, or "not measured: <why>">
   harness: <the exact command or query that produced today, with the repo and ref it ran against>
   verifier: <the exact branch-level command a run uses to keep or revert before the PR opens, and how it is run on baseline and candidate; for an audit the inventory command it qualified on, for an ops loop the queue count read in the session>
   field check: <code-changing loops: the production gauge read one deploy later; ops loops: the queue trend read at the next run>
   owner: <the person who will own the loop; the creator of a loop owns it, so in team mode name whose sessions and PRs carry the recurrence>
   evidence: <count of slices / sources>, <pointer>, <pointer>, <pointer>
   overlaps: <automation, responder, scan or skill it touches, or "none">
   readiness: <skill or recipe that does the unit of work>
   mission: <one sentence in the solar-loop mission form>
   score: recurrence <n> · pain <n> · measurability <n> · readiness <n> = <sum>
```

Then: `needs verifier` items, each with the proxy to build; "not a loop" with each failing test; "already looped" with each covering automation; the appendix of weak signals. Close with which candidate to hand to `/solar-loop` first, what it still needs from the user (cadence, channel, threshold), and which candidates' verifiers are strong enough that a kept result could merge on the required review's approval alone. Evidence pointers are inline links.

## Hand-off

Call `/solar-loop` with the chosen block: metric and today's value become the metric contract; `verifier` becomes its harness, vetted with `@skills:benchmark-checklist`; `field check` stays the production query behind `today`; overlaps become the dedupe set; readiness becomes the skill the prompt names.

## Rules

- Read only the target's channels and sessions, and quote private messages only as pointers.
- "Today" is measured, never estimated.
