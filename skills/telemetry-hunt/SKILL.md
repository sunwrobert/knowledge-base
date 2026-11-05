---
name: telemetry-hunt
description: Investigate a recurring production telemetry hunt in the current repository, rank findings by owning layer, and hand one proven repo-side fix to the caller. Use when asked for a telemetry hunt, production error or performance sweep, or a recurring Datadog investigation that should select a fix.
metadata:
  version: 1.0.0
---

# Telemetry Hunt

This skill investigates and reports. The caller ships the selected fix, usually through [`ship-with-proof`](../ship-with-proof/SKILL.md) when available, and returns its outcome for the final report. Do not implement, prove, or ship the fix in this skill. Do not turn a supported repo-side candidate into an open-ended recommendation to a person.

Read [`show-me`](../show-me/SKILL.md) for the final findings diagram before starting, and the org's Datadog access instructions, if any. Work in the repository the caller names. Do not run a generic sweep without the caller's checks.

## Inputs from the caller

- Surfaces in scope and the telemetry source for each.
- Checks to run, the grouping key and flag criterion for each check.
- Noise filter defining what this hunt owns, including signals owned by other hunts.
- Window and baseline if they differ from the four-hour / seven-day defaults below, or the triggering error or incident for an event-shaped hunt.
- Exact PR-body dedupe marker line, such as `apm-hunt-candidate: <service> <resource>`.
- Verdict line and disposition vocabulary for the report.

If an input is missing, obtain it from the invoking request or caller before claiming coverage; do not invent thresholds, surfaces, or noise criteria.

## Datadog access

- Site and keys come from the environment; export `DD_SITE` before running `pup` or calling the API: `DD_SITE` (e.g. `datadoghq.com`, `us5.datadoghq.com`, `datadoghq.eu`), `DD_API_KEY`, `DD_APP_KEY`. Call the API at `https://api.$DD_SITE`; the default `api.datadoghq.com` returns Forbidden for keys from another site. User-facing links use the site's UI host: `https://app.$DD_SITE` for a bare site (`datadoghq.com`, `datadoghq.eu`), `https://$DD_SITE` for a prefixed one (`us5.datadoghq.com`). Never print key values or echo them into logs, PRs, or messages.
- The [`dd-pup`](../dd-pup/SKILL.md), [`dd-logs`](../dd-logs/SKILL.md), [`dd-apm`](../dd-apm/SKILL.md) and [`dd-monitors`](../dd-monitors/SKILL.md) skills drive the `pup` CLI. Headless install with API keys, no browser login:

  ```bash
  mkdir -p ~/bin
  VER=$(curl -s https://api.github.com/repos/datadog-labs/pup/releases/latest | grep -m1 tag_name | cut -d'"' -f4)
  curl -sL "https://github.com/datadog-labs/pup/releases/download/${VER}/pup_${VER#v}_Linux_x86_64.tar.gz" | tar xz -C ~/bin pup
  export PATH="$HOME/bin:$PATH"
  pup auth status   # expect "auth_method": "api_keys", "status": "valid"
  ```

  Use `Darwin_arm64` / `Darwin_x86_64` on macOS. If the GitHub API is rate limited, pin a tag from the releases page. A keychain-unavailable warning is harmless headless; skip `pup auth login`, it starts a browser OAuth flow. A Datadog MCP server, when configured, is an alternative.

- Confirm the `env:` tag with the user before filtering by it; do not assume `prod` or `production`. Discover valid `service:` names first (`pup apm services list --env <env> --from 1h --to now` or `pup logs aggregate --query "*" --compute count --group-by service --from 1h`). Prefer scoped time windows (`--from 1h`, `--from 24h`) and `--limit` to keep output small.

## Telemetry rules

- Back off and retry on `Too many requests`. Know the org's log retention before choosing a baseline window.
- Take every rate, count, and percentile from an aggregate source, such as trace metrics, log or RUM analytics, or an analytics warehouse. Span, log, and RUM event search gives structure, attributes, and examples, not traffic denominators. Call an event-search count a _retained count_, never a traffic count. Error events are retained more often than successes.
- Run the exact query and time range through the Datadog aggregate API and confirm a nonzero count before publishing any Datadog link. Include the raw query beside the pinned link. Do not put `*` inside a quoted phrase; use an OR of exact quoted variants or an unquoted escaped wildcard term.
- A sampled trace may hide a sibling. Millisecond timestamps cannot order sub-millisecond spans. Discard a causal attribution or candidate that the available events do not establish.

## Procedure

1. **Scope the comparison.** For a window-shaped hunt, compare the last four hours of the production env with the same surface and clock window over each of the preceding seven days using aggregate data. If telemetry began later, use the longest clean same-clock baseline available, say how short it is, and lower confidence. Analyze threshold breaches even if steady-state; classify change from normal or a new pattern too. Give the baseline numbers for each comparison. For an event-shaped hunt, establish first seen, frequency, affected users or requests, and whether it still occurs.
2. **Filter before ranking.** Apply the caller's noise filter, separating owned signal from third-party, extension, bot, synthetic, client-side, and other-hunt signal. Record what was filtered and why, including any class that may hide real impact.
3. **Run every named check.** Group by the caller's key and budget roughly equal effort per surface. Break down each flagged finding by layer using this run's data. For frontend routes inspect server response, first paint, largest paint, first-party fetches, and long tasks; for backend resources inspect the root's child spans. Name the deepest failing layer and its measured share of time. Separate the aggregate result from what individual events suggest.
4. **Dedupe prior runs.** Read recent reports of this hunt. Re-check each earlier attribution against this run's layer breakdown. Carry an unchanged finding as known only when the layer was established with evidence; mark material worsening as known-worsening and newly appearing patterns as NEW. Never inherit a disposition solely from an older report.
5. **Dedupe work in flight.** Search open and closed PRs in the repository by surface, route, touched files, error signature, and the exact marker line. Check whether the fix is already on the default branch. Record merged fixes or fixes already on the default branch as fixed, and relevant open PRs as in flight. Review closed, unmerged PRs for context, but keep their findings eligible for selection.
6. **Select at most one candidate.** Choose the highest-impact remaining change in this repo that is reasonable to open, weighing size, risk, and strength of proof. Repo-owned 5xx and correctness faults qualify even below a volume threshold when they are the only repo-owned defect. An external root cause also qualifies if a repo change materially reduces its impact through a retry, timeout, fallback, error mapping, or corrected response. Select product or cross-layer changes when justified and give the tradeoff to the PR reviewer. Skip only findings no repo change would move or whose fix cannot be proven locally; name the measurement and owning layer behind each skip. If all are skipped, state what repo change would move each finding and why it was not taken.
7. **Hand off the selection.** Give the caller the defect, failure condition to reproduce, check that surfaced it, current and baseline or first-seen numbers, required telemetry evidence and marker below, and an after-comparison recipe. Require the caller to reproduce the failure and prove the changed behavior with scoped tests and the affected local end-to-end flow before opening any PR. For a performance fix, also require before and after timings of the changed path under identical local conditions, noting that local timings bound the shape of the win rather than its production magnitude. If this pre-PR proof fails, no PR is opened; report the missing measurement. After it passes, the caller may use `ship-with-proof` to open the PR with those results and complete its remaining gates. Report any later gate failure as an incomplete PR rather than claiming final proof. The caller returns the PR or failure outcome. Do not implement, prove, or ship it yourself.
8. **Report once after the caller returns.** Lead with the caller's verdict line and the PR link if opened. Use `show-me` to render the findings as one fenced `text` block grouped by owner or check class. Put one indented node per finding, with grouping key, comparison or first-seen, deploy correlation, and disposition on separate lines. Put links, tickets, and PRs in a short hyphen list immediately below. Then list surfaces checked, noise filtered, degraded baselines, review-loop rounds reported by the caller, and anything the loop waived. Use **bold** and hyphen bullets, no tables or collapsible elements. Post only in the session, never to a chat channel unless asked.

```text
<owner or check class>
  <grouping key> · <surface> · <signature>
    current <n> vs baseline <n>/day
    deploy: <sha or none>
    disposition: <NEW | known-worsening | in flight <PR> | misclassified | fixed <PR> | skipped: <measurement> | benign: <reason>>
```

## Evidence to hand to the caller

Every finding needs its comparison numbers, raw aggregate query, and explicit time range. For Datadog evidence, include a pinned link on the site's UI host with `start` and `end`. Validate its exact query and time range through the aggregate API before publishing. For warehouse-only evidence, include the raw query and time range with a link to the query or result when available. Do not invent a Datadog link. Give the retained count behind each event-search link and a representative trace, session, or log when structure matters. State when the source cannot provide a shareable link or event record.

For a selected PR, require the **PR body itself** to contain the finding and triggering check, aggregate metric comparisons with raw queries and source-specific pinned links where available. When event evidence exists, include event-search raw queries, retained counts and pinned links where available, representative trace IDs with timestamps when traces exist, and a pinned direct link to at least one individual span, trace, or log event when the source supports one. For error findings, include the observed production error message with its full stack trace or the full local reproduction stack trace. For span-backed findings, include relevant attributes such as status, duration, and `@git.commit.sha`, plus error metadata for error findings. For latency-only findings, include before and after local timings under identical conditions and telemetry showing which layer owns the time. Explain unavailable source links or event evidence. Do not select a candidate whose cause cannot be proven. Distinguish what aggregate metrics establish from what event samples show. A local file or chat link alone does not satisfy the PR evidence contract.

The after-comparison recipe names a Datadog query with `@git.commit.sha:(<before_sha> OR <after_sha>)`, or an equivalent query in the source of a warehouse-only check, grouped by the check's key and SHA. Name the primary metric, a success threshold, and a minimum cohort size below which the comparison is inconclusive.

## Completion checks

- Every scoped surface was checked or its omission has a reason. Every flagged finding has this run's layer breakdown, owning layer, and aggregate-backed comparison.
- Every skip names the owning layer and measurement; no finding is left as “needs human.” A self-resolving cluster is not presented as a live incident and an unproven cause is not stated as confirmed.
- At most one proven candidate is handed off. The caller's PR, when opened, carries the complete evidence above. If no proof can be produced, report what measurement would settle the finding instead.
- The session receives exactly one final report after the caller's fix step. Do not commit findings, reports, or measurement files to the repository.
