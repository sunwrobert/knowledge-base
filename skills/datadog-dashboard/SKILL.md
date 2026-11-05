---
name: datadog-dashboard
description: >-
  Build or extend a Datadog dashboard over the Datadog API by reading a human-curated template dashboard and creating a new one in its format, then checking every widget returns data. Use when asked to "make a Datadog dashboard", "build a dash for X", "clone this dashboard for Y", "add charts to a dashboard", or to turn metrics or logs into a dashboard quickly without an infrastructure-as-code PR. Dashboards already managed in Terraform stay in Terraform.
metadata:
  version: 1.0.0
---

# Datadog dashboards

Read the org's Datadog access instructions first, if any. Site and keys come from the environment: `DD_SITE` (e.g. `datadoghq.com`, `us5.datadoghq.com`, `datadoghq.eu`), `DD_API_KEY`, `DD_APP_KEY`. Every call below goes to `https://api.$DD_SITE`; keys from one site get Forbidden on another. Every link you share is on the site's UI host: `https://app.$DD_SITE/dashboard/<id>` for a bare site (`datadoghq.com`, `datadoghq.eu`), `https://$DD_SITE/dashboard/<id>` for a prefixed one (`us5.datadoghq.com`). Never print key values. For discovery with the `pup` CLI, see [`dd-pup`](../dd-pup/SKILL.md) or the headless install in [`telemetry-hunt`](../telemetry-hunt/SKILL.md).

## Where the dashboard lives

- A new or exploratory dashboard is created and edited over the API. Iteration is faster than a Terraform PR, and a human keeps tweaking it in the Datadog UI afterwards. Put `Managed via Datadog API; not Terraform.` at the end of its `description`.
- A dashboard declared in the org's Terraform (search the infrastructure repo for its id or title) is Terraform-owned. Change it with a PR that follows that directory's conventions. An API edit to it is reverted on the next apply.
- Widgets the repository keeps in a Terraform-owned per-service dashboard go through Terraform with the metric, per that repository's rules.

## 1. Pick the template

Format comes from a dashboard a human already curated, not from scratch. Use the one the requester names. Otherwise list dashboards (`GET /api/v1/dashboard`), pick the closest curated match, and say which you chose. Two common shapes:

- Investigation board: log- and metric-heavy. Ordered layout, titled groups, a 4-across grid of 3x2 timeseries, `toplist` widgets for worst-N breakdowns, template variables for the dimensions people filter on, and an "agent sandbox" group.
- KPI board: a full-width `note` header, rows of 3x1 `query_value` cards, 6x4 trend timeseries in pairs, 7d / 30d / full-history variants of the same chart side by side, and an `env` template variable.

Fetch it and read the structure before writing anything:

```bash
API="https://api.${DD_SITE:-datadoghq.com}"
TEMPLATE=<template-dashboard-id>
curl -s -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
  "$API/api/v1/dashboard/$TEMPLATE" > template.json
jq '{title, layout_type, reflow_type, template_variables, widgets: [.widgets[].definition | {type, title, kids: [(.widgets // [])[].definition | {type, title}]}]}' template.json
```

## 2. Carry the template's format

Copy these from the template instead of choosing new values:

- `layout_type`, `reflow_type`, and the 12-column grid: widget `layout` widths and heights, and how many widgets share a row.
- Widget kinds per job: `query_value` for a headline number, `timeseries` for a trend (`bars` for counts, `line` for gauges and percentiles), `toplist` for a ranked breakdown, `query_table` for multi-column comparisons, `note` for the header and caveats.
- Title style, e.g. `<what> · <scope> · <window>` (`Daily cost by product · 30d`) or `<what> by <tag>` (`OOM by region`), in the template's casing.
- Legend settings, palettes, `number_format` units, and `time.live_span` overrides.
- Template variables, with the same names and prefixes where the new dashboard filters on the same tags, so links between the two boards keep their filters.

Discover the real metric names and tag values before writing a query (`pup metrics search`, `pup logs aggregate --group-by`, or a Datadog MCP server). A widget whose query names a metric or facet that does not exist shows an empty chart without erroring.

Grouped timeseries use `top(query1, 50, 'mean', 'desc')` or a group-by `limit` of at least 50, so the default top 10 does not hide the tail. Use a lower limit only for a tag with a fixed small set of values.

Restricted data: if the org keeps regulated or sensitive data in a separate service or index that agents must not chart, every log query excludes it (`-service:<restricted>`), and no widget targets it; hand that dashboard to a human. Pass each such name to the checker with `--restricted <name>` and it refuses to replay a query that targets it.

## 3. Create it

Write the new definition to `dashboard.json` (title, `description`, `layout_type`, `reflow_type`, `template_variables`, `widgets`; drop the template's `id`, `url`, `author_*`, `created_at`, `modified_at` and widget `id` fields), then:

```bash
curl -s -X POST -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
  -H "Content-Type: application/json" -d @dashboard.json \
  -o created.json -w '%{http_code}\n' "$API/api/v1/dashboard"
jq '{id, url, errors}' created.json
```

A status other than 200 prints Datadog's `errors` array; fix the definition and retry instead of reporting. If curl got no status at all (timeout, dropped connection), list dashboards (`GET /api/v1/dashboard?filter[shared]=false`) and look for the title before posting again, so a lost response does not leave a duplicate.

To change an existing API-managed dashboard:

1. `GET /api/v1/dashboard/<id>` into `before.json` and keep it as the restore point.
2. Edit a copy of the JSON. `PUT` replaces the whole dashboard: a body with only the new widgets deletes the rest.
3. Right before the `PUT`, `GET` again and compare `modified_at` with `before.json`. If a human edited the dashboard in between, start over from the fresh copy so the `PUT` does not revert their edit. Save the `modified_at` the `PUT` returns.
4. To undo, `GET` again first. If `modified_at` still equals the value saved in step 3, `PUT` `before.json`. If it moved, a human edited after you: remove only your widgets from the fresh copy, or ask the human.

## 4. Leave curated widgets alone

On a dashboard a human curated, add new or unproven charts to its agent sandbox group (create a group titled `Agent sandbox` with a `note` saying what it is for if the dashboard has none). Do not edit, move, or delete widgets outside that group unless the requester names them. A chart moves out of the sandbox when a human decides its signal is trustworthy.

## 5. Check every widget

Run the bundled checker on the new or edited dashboard. It reads `DD_SITE`, replays each widget's queries through `/api/v2/query/timeseries` or `/api/v2/query/scalar` over the widget's own `live_span` (or `--hours`) with template variables at their defaults, and exits non-zero if any formula in any widget returns no data:

```bash
python3 <this skill's directory>/check_widgets.py <dashboard-id> --hours 24 [--restricted <service>]
```

Fix or remove every `empty`, `error`, `unsupported` or `refused` row on a widget you added or were asked to change before you report. A failing row on a curated widget you did not touch stays as it is; list it in the report as pre-existing. A widget that is empty on purpose (an error count that is zero today) gets a longer window (`--force-hours 168`, which also overrides a widget's own `live_span`) to prove the query matches anything, and the report names it.

## 6. Report

Lead with the dashboard link, then the template it was built from, the checker's result line, and every widget that is empty on purpose. Attach a screenshot of the dashboard when the requester will not open Datadog.
