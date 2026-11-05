---
name: ga4
description: Pull live Google Analytics 4 data for a site (sessions, users, pageviews, traffic by source, landing pages, AI referral traffic from ChatGPT/Perplexity/Gemini/Claude). Use when asked about GA4, site traffic, organic vs direct vs referral sessions, or how much traffic AI assistants send. Reads through the GA4 Data API when a GA4 credential is configured, otherwise through Gauge's run_ga4_report.
metadata:
  version: 1.0.0
---

# GA4

Two paths, depending on what the environment provides:

- A GA4 credential (service account with Viewer on the property, plus the numeric property ID): call the GA4 Data API `runReport` directly and say so in the report.
- No GA4 credential but a Gauge workspace connected to GA4: use `GAUGE_API_KEY` and the caller in [`gauge`](../gauge/SKILL.md)'s `scripts/gauge.sh`. The recipes below are written for this path; the dimension, metric and filter names are the GA4 Data API's.

Ask the user which property to read if neither is configured.

## Run (via Gauge)

```bash
G=../gauge/scripts/gauge.sh
$G call run_ga4_report '{"dimensions":["date"],"metrics":["sessions","totalUsers"],"start_date":"2026-08-04","end_date":"2026-08-31","dimension_filters":[],"filter_logic":"and","order_by":null,"limit":100,"property_id":null}'
$G call get_SEO_overview '{"start_date":"2026-08-04","end_date":"2026-08-31"}'
```

All keys in `run_ga4_report` are required by the schema. Pass `[]`, `null`, or a default rather than omitting them. `property_id: null` uses the workspace's default property.

Response is CSV text in `result.content[0].text`.

## Recipes

Traffic by channel
`dimensions ["sessionDefaultChannelGroup"]`, `metrics ["sessions","totalUsers","engagedSessions"]`.

Organic landing pages
`dimensions ["landingPage"]`, `metrics ["sessions","engagementRate"]`, filter `{"dimension":"sessionDefaultChannelGroup","match_type":"exact","value":"Organic Search"}`, `order_by "sessions"`.

AI assistant referrals
`dimensions ["sessionSource"]`, `metrics ["sessions","totalUsers"]`, filter `{"dimension":"sessionSource","match_type":"regex","value":".*(chatgpt|perplexity|gemini|claude|copilot).*"}`.

Page traffic for one path prefix
`dimensions ["pagePath","date"]`, filter `{"dimension":"pagePath","match_type":"begins_with","value":"/blog/"}`.

## Rules

1. GA4 regex filters are full-match. Wrap partial patterns in `.*...*`.
2. GA4 `sessions` and Search Console `clicks` measure different things. Report both with their names, never as one "traffic" number.
3. Use windows ending yesterday or earlier. Same-day GA4 data is incomplete.
4. Compare equal-length windows. State both date ranges in the output.
5. Reads only.
