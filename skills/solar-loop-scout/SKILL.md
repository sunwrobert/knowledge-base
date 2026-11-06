---
name: solar-loop-scout
description: >-
  Find loop opportunities: recurring, bounded, measurable work that a scheduled Devin automation in the solar-loop style could own. Mines a person's Devin sessions, PRs and Slack messages, or a team's OKRs, Linear projects and channels, cross-checks every signal across at least two sources, and returns a ranked candidate list where each row names the metric to climb or count to burn down, the evidence it recurs, the existing automation or skill it overlaps, and a mission sentence ready for /solar-loop. Use when asked for "/solar-loop-scout", "loop scout", "what should I automate", "find loop opportunities for <team or person>", "what do I keep doing by hand", "what could be a hunt", or before creating a batch of automations.
metadata:
  version: 1.1.0
---

# solar-loop-scout

Finds the loops worth building before anyone builds one. A loop is worth building when the same bounded work recurs, a number says whether a run helped, a verifier can say so before merge, and no automation or skill already owns it. In reward-function terms: every pillar or OKR metric is a reward function already; what a loop still needs is the verifier, the in-session check that a candidate change moved the metric or will, so the scout's main job is to find the metrics whose verifier is cheapest. The output is a ranked list of candidates; the hand-off is [solar-loop](../solar-loop/SKILL.md), which turns one candidate into an automation.

## Inputs

Ask only for what the request does not imply; otherwise decide and state the assumption in the report.

- The target: one person (their handle, Devin user id, Slack user id) or one team (its Linear team or project names, its Slack channels, its OKR page).
- The window: default the last 60 days, split into three slices of 20 days.
- The repo or repos the target works in, so inventories can be counted there.
- How many candidates to return: default the top 5, with the rest in an appendix.

## Sources

Mine every source that applies; a candidate needs evidence from at least two of them before it ranks.

Person mode:

- Devin sessions: `devin_session_search` with `user_ids`, `created_after` and `created_before` per slice, `first=100`, paged with `after`. Drop `origin=automation` rows (already loops) and `parent_session_id` rows (children of one task); cluster the remaining titles by surface. `devin_session_insights` with the same filters adds the classification and issue titles where an analysis exists. For a cluster that needs more than its titles, `devin_session_events` on two or three sessions shows what was actually asked.
- Automations, across every creator: `devin_automation_manage` with `action=list` and `enabled=true`, `devin_oncall_manage` with `resource=responder`, and `devin_code_scan_manage` with `action=list_scans`, then `get` on each one whose name, prompt, repo tokens or channel grants touch the target's repos, channels or surfaces. This is the dedupe set; a teammate's automation owns a surface as fully as the target's own. The target's own list (`creator_id`) adds context on which surfaces they already chose to loop, not the boundary of the check.
- Slack: `slack_search_public_and_private` with `filters` `from:<@U...> after:<slice start> before:<slice end>` and one keyword per query (`again`, `every`, `manual`, `flaky`, `slow`, `migrate`, `remind`, `automate`, the names of their repos), `sort=timestamp`, `limit=20`; page with `cursor` when the first page is all one channel. A channel that dominates the results is a signal in itself.
- GitHub: `gh search prs --author <handle> --merged --created "<slice start>..<slice end>" --json number,title,repository,closedAt` and the same for open PRs; titles that repeat across slices (`fix flaky`, `bump`, `migrate`, `remove`) are candidates.
- Memory and skills they maintain: the skills they authored and the knowledge notes that name them say what they already codified; a codified workflow with no schedule is a loop waiting for one.

Team mode:

- OKRs: `notion-search` for the quarter's goals and pillar pages, then `notion-fetch` on each; every row of a success-metrics table with a baseline, a target and a source is a metric a loop could climb. Linear `list_initiatives` with `includeProjects` and `get_initiative` for the same.
- Linear: `list_projects` by team, `list_issues` by team with `createdAt` at the window start, bucketed into the slices by each issue's `createdAt`, clustered by label and title words; the issues that reopen or repeat are the backlog a loop drains.
- Slack: the team's channels via `slack_read_channel` per slice and `slack_search_public_and_private` with `in:<#C...>`; hunt complaint threads, alert noise, "someone should", "every release", "again", and bot posts nobody answers.
- Alert and CI channels the team owns: the volume per alert name per slice, read with `slack_search_public_and_private` using `include_bots=true` and `in:<#C...>`.
- Telemetry the team owns: the Datadog monitors and dashboards tagged to the team, and any metric the OKR page names as its source.

## Mining procedure

Run the three slices as parallel subagents when the volume warrants it, one slice each, with the same signal list; otherwise run them in sequence. Every query carries both the slice start and the slice end, so the slices partition the window and one record lands in one slice. Each slice returns a list of `signal → evidence pointers` with the source, stable id (session id, PR number, Slack ts, issue identifier) and date of every pointer; dedupe pointers by id across slices before counting.

Signals that indicate a loop:

- Repetition: the same verb and surface appear in two or more slices (fix flaky X, bump Y, re-review Z, migrate W, triage channel V).
- Manual cadence: a person does something weekly or daily by hand, or posts a reminder to do it.
- An inventory that only shrinks by hand: imports of a deprecated module, call sites of an old API, files outside the design system, tests on a legacy runner, `TODO(migrate)` markers.
- A number someone watches: a dashboard checked in several sessions, an OKR metric with a source, a CI duration, an error rate, a bundle size.
- A branch in code on a hardcoded identity (a vendor enum, a plan-name switch, a per-customer flag) where the object it stands for could carry the data: counting those branches is a burn-down and each one removed is a verifier-friendly PR.
- A change that touches many files the same way every time (adding a payment method edits several files): the count of files per instance is the metric and one config entry is the target.
- Unanswered alerts: a channel where bot posts outnumber human replies.
- Friction the person names: "again", "every time", "why does this keep", "someone should", "can we automate".

Cross-check before elevating: a signal seen in one slice from one source is weak and goes to the appendix; two slices or two sources make it a candidate; three make it strong. Record the count of distinct records behind it, not the count of queries that returned them.

## Qualification

A candidate qualifies only when all five hold; a candidate that fails one is listed under "not a loop" with the failing test.

- Recurs: the work comes back on its own, at a rate the evidence shows.
- Bounded: one run can finish a unit of it in one session (one fix, one batch, one queue drain) without a human decision mid-run.
- Measurable: a metric fits the [solar-loop metric contract](../solar-loop/SKILL.md#metric-to-climb): a production number with a direction, or an inventory count that goes to zero, found by a command that can be frozen. Name the harness or inventory command and, when the repo is available, run it once so the candidate carries today's value.
- Verifiable: name how a run proves its change helped before anyone merges it. For a loop that changes code the verifier must measure the branch in the session (an inventory count, a bundle size, a test that passes, a local production build measurement, a replay against a captured production sample), because solar-loop compares baseline and candidate with identical commands and keeps or reverts before the PR opens. A production gauge read one deploy later (a p75, an error rate) is the field check, not the verifier; a candidate whose metric is production-only qualifies only once a branch-level proxy is named for it (synthetic Lighthouse on a local production build for LCP, a replayed error sample for an error rate, a timed local run for a CI duration), and until then it is listed as `needs verifier`, not ranked. An ops loop's verifier is the queue count it drains, read in the session. A human judgment is not a verifier.
- Unowned: no enabled automation, Oncall responder, scheduled scan, or skill-with-a-schedule in the dedupe set above, by any creator, already covers the surface. Overlap with an existing skill that has no schedule is not disqualifying; it is the fastest candidate, because the loop only needs to call the skill.

## Ranking

Score each qualifying candidate on four axes, 1 to 3 each, and sort by the sum; break ties toward the lower first-run cost.

- Recurrence: how often the evidence shows it coming back.
- Pain: how much human time or production impact each recurrence costs, from the evidence, not inferred.
- Measurability: the branch-level verifier is already frozen or is the inventory command itself (3), a branch-level proxy is named and runs in one session but is not yet vetted (2), the named proxy is costly enough to dominate a run, such as a production build per measurement (1). Only qualified candidates are scored; a candidate with no named branch-level verifier sits under `needs verifier` with no score.
- Readiness: a skill or playbook already does the unit of work (3), a clear recipe exists in sessions or docs (2), the mechanism is unknown (1).

## Report

Lead with `solar-loop-scout — <target>, <window>: N candidates, top: <one line>`. Then one block per candidate, ranked:

```text
<rank>. <Name> — <shape: hill climb | burn-down | telemetry hunt | ops loop>
   metric: <number, unit, direction, or "remaining <instances> → 0">
   today: <value from running the harness or inventory command, or "not measured: <why>">
   harness: <the exact command or query that produced today, with the repo and ref it ran against>
   verifier: <the exact branch-level command a run uses to keep or revert before the PR opens, and how it is run on baseline and candidate; for a burn-down this is the harness itself, for an ops loop the queue count read in the session>
   field check: <code-changing loops: the production gauge read one deploy later; ops loops: the queue trend read at the next run>
   owner: <the person who will own the loop; the creator of a loop owns it, so in team mode name whose sessions and PRs carry the recurrence>
   evidence: <count of slices / sources>, <pointer>, <pointer>, <pointer>
   overlaps: <automation, responder, scan or skill it touches, or "none">
   readiness: <skill or recipe that does the unit of work>
   mission: <one sentence in the solar-loop mission form>
   score: recurrence <n> · pain <n> · measurability <n> · readiness <n> = <sum>
```

After the ranked list: `needs verifier` for candidates that pass the other tests but have no branch-level measurement yet, each with the proxy to build; "not a loop" with the failing qualification test per item, "already looped" naming the covering automation per item, and the appendix of weak single-source signals. Close with the next step: which candidate to hand to `/solar-loop` first, and what it still needs from the user (a cadence, a channel, a threshold). Say which candidates have a verifier strong enough that, once the loop has a run of kept results, its PRs could merge on the repository's required review alone; that is the end state a loop is built toward, even while the automation itself never merges. Put the evidence pointers inline as links; never ask the reader to trust a count they cannot open.

## Hand-off

For the candidate the user picks, call `/solar-loop` with the candidate block as its input: the metric and today's value become the metric contract, the `verifier` line is the command solar-loop vets with `@skills:benchmark-checklist` and then freezes as its harness, the `field check` line becomes its field check (the production query behind `today` stays there, never as the branch harness), the overlaps become the dedupe set, and the readiness entry becomes the delegation. Do not create the automation from this skill.

## Forbidden

- A candidate with evidence from one slice and one source in the ranked list, or a recurrence count that was not deduped by record id.
- A dedupe set limited to the target's own automations.
- A metric the loop cannot measure in its own session, a ranked candidate whose only verifier is a post-deploy gauge, or a "today" value that was estimated instead of run.
- Ranking by what sounds important instead of by the four scored axes.
- Reading channels or sessions outside the named target, or quoting private messages in the report beyond the pointer.
- Creating or updating an automation from this skill.
