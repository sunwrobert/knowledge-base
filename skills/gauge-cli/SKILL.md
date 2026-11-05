---
name: gauge-cli
description: Use Gauge's CLI (`@withgauge/cli`, command `gauge`). This is Gauge's coding-agent product, not the AEO dashboard - it runs real coding agents (Claude Code, Codex, Cursor) against a product in a sandbox and measures Agent Preference (which packages and brands agents install, share of voice, mention rate), judged eval sets over the product's docs and skills, runs and their traces, the Action Center, and optimizations that trial one docs or skill change at a time. Use when asked whether coding agents pick a product, to run or read a Gauge eval, to watch a run, or to improve docs/skills against a measured baseline. Needs `GAUGE_API_TOKEN` (a `gauge_...` personal token); the MCP key used by the gauge skill does not work here. Reads by default; anything that spends credits needs explicit human confirmation.
metadata:
  version: 1.0.0
---

# Gauge CLI (Agent Preference, evals, runs, optimizations)

Two Gauge surfaces exist and they do not share credentials or data:

- [`gauge`](../gauge/SKILL.md) - the MCP endpoint at `app.withgauge.com/mcp`, `GAUGE_API_KEY`. AI answer-engine visibility (ChatGPT, Perplexity, Gemini), citations, topics, competitors, keyword research, GA4. Use it for AEO reports.
- this skill - the `gauge` CLI over the Gauge API, `GAUGE_API_TOKEN`. Coding agents as the audience: what they install, how they handle the product's docs and skills, judged evals, optimization trials.

If the question is about AI answers citing the site, stop and load `gauge`. If it is about coding agents choosing or using the product, stay here.

## Install

```bash
npm i -g @withgauge/cli@0.11.0   # the version this skill documents; bump the pin and re-check `--help` together
gauge --version
gauge instructions           # read fully before the first command; `gauge instructions <topic>` for one group
```

## Access

- Credential: `GAUGE_API_TOKEN`, a personal access token that starts with `gauge_`. The CLI reads it from the environment; `gauge auth login` stores one locally instead (browser callback by default, `--device` for a headless box, `--with-token` to paste one from stdin).
- Check the environment for `GAUGE_API_TOKEN` first. If it is absent, ask the user whether to log in for this session (`gauge auth login --device`, post the URL and code for a human to approve) or to create and save a token (`gauge auth tokens create <name>` prints the secret once; a human runs it and stores it). Do not mint tokens without being asked.
- `GAUGE_API_KEY` from `gauge` is rejected with `Missing or malformed Authorization header (expected: Bearer gauge_...)`. Do not retry it.
- Org: every command needs an org. `gauge orgs list -o json`, then pass `--org <slug>` or run `gauge orgs use <slug>` once (writes local config only).
- Network: `agents.withgauge.com` (default `apiUrl`, overridable with `gauge config set apiUrl`), plus the npm registry for install.
- Never print, log, or commit `GAUGE_API_TOKEN`.

## Rules (from `gauge instructions`, keep them)

1. Pass `-o json` on every read and parse that. Tables are for people.
2. Every launch spends credits: `evals run`, `preference run`, `optimizations start|start-draft|launch|continue`, `optimizations trials add --launch`, `optimizations trials run`, `runs fork`, `batches`. Confirm with a human in the current conversation before each one. `--yes` is only for a script the user already approved.
3. Retry a write only with its idempotency flag (`--idempotency-key`). A blind retry buys a second set of paid sessions.
4. Report measured results only, with the sample count. Never state a score the sessions did not produce, and never compare runs with different rosters, models, or criteria as if they were one series.
5. Exit codes: 0 ok, 1 error, 2 usage, 3 billing-blocked, 4 needs your input (`optimizations watch` returns 4 when it is your turn to author).
6. Never edit an eval, its criteria, or its prompt to make a trial pass. One variable per trial, hypothesis written first.
7. Nothing the CLI does touches the product's repository. Adopted optimizations move Gauge's baseline, not the source. Winning text ships through a normal PR that cites the trial key and score.

## Command map

Read (safe):

- `gauge whoami`, `gauge status` - one-shot org summary: actions, visibility, agent experience.
- `gauge preference list|get|scenarios|runs <id>`, `gauge preference markets` - Agent Preference prompts and tracked markets.
- `gauge stats rankings|installs|brands|funnel|domains` - brands ranked by install rate, package install share of voice, mention rate beside install rate, outbound fetch domains. Filters: `--prompt`, `--tag`, `--repo`, `--language`, `--framework`, `--branded|--unbranded`.
- `gauge evals list|get|runs <id>` - eval sets with pass-rate stats and per-criterion verdicts. `--agents claude-code,codex --models <slugs> --since <date>` scope the stats.
- `gauge runs list|get|insight|logs|diff <id>` - run status, cost, LLM analysis of decisions, trace events, working-tree diff. `gauge runs watch <id>` streams live until the run ends.
- `gauge optimizations list|get|activity|diagnose|estimate` - trial ladders, decision logs, improvement opportunities, and price before starting.
- `gauge skills list|get|runs <ref>` - skills Gauge stages into runs, with versions.
- `gauge actions list --status open` - Gauge's action center for this surface.
- `gauge query datasets|fields`, `gauge query run --dataset runs|installs|mentions|web|network|files|tokens -d <dims> -m <metrics> --last-days 30` - ad hoc reports over the event warehouse.
- `gauge models list`, `gauge billing status`, `gauge usage`, `gauge dashboards list|get`.

Write (needs confirmation; the ones marked $ spend credits):

- `gauge evals create|edit|rm|tag`, `gauge evals run <id>` $.
- `gauge preference create|edit|rm|tag`, `gauge preference run <id>` $, `gauge preference synthesize`.
- `gauge optimizations create|update`, `start` $, `start-draft` $, `launch` $, `continue` $, `trials add` (`--launch` $), `trials run` $, `adopt`, `cancel`, `complete`, `delete`.
- `gauge runs fork` $, `gauge runs cancel`.
- `gauge skills add|edit|reingest|rm`, `gauge actions status <id> open|resolved|dismissed`, `gauge tags`, `gauge brands`, `gauge dashboards create|rename`, `gauge orgs create`, `gauge auth tokens create|revoke`.

The CLI has no `prompts` group in 0.11.0. Preference prompts are under `preference`, eval sets under `evals`.

## Typical flows

Do coding agents pick the product: `gauge stats brands -o json` and `gauge stats funnel -o json`, scoped with `--unbranded` to see unprompted preference, then `gauge stats installs --branded -o json` for branded prompts. Report install rate and mention rate with sample counts and the date range.

Read an existing eval: `gauge evals list -o json` -> `gauge evals get <id> -o json` (criteria, roster, cadence) -> `gauge evals runs <id> -o json` -> `gauge runs insight <runId> -o json` for why a criterion failed.

Run an eval (spends credits): confirm the eval id, roster, and estimated sessions with a human -> `gauge evals run <id>` -> `gauge runs watch <runId>` -> `gauge runs insight <runId> -o json` -> summarize per-criterion verdicts with counts.

Improve a docs page or skill against a measured baseline: `gauge instructions optimizations` -> `gauge optimizations diagnose --eval <id> -o json` -> `gauge optimizations estimate --eval <id> --target <agent:model> -o json` -> human confirms -> `gauge optimizations start --eval <id> --target <agent:model>` -> `gauge optimizations watch <optId>` until exit 4 -> author against the frozen base (`gauge optimizations page <optId> --url <url>` or `gauge optimizations skill-files <versionId>`) -> `gauge optimizations trials add <optId> --title <t> --hypothesis <h> --page <url> --body-file <path> --idempotency-key <key>` (or `--edit-skill <versionId> --skill-dir <path>`) -> human confirms -> `gauge optimizations launch <optId>` -> `gauge optimizations change <optId> <trialId> --body` prints the winner -> apply it to the real source in a PR.
