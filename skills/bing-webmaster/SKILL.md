---
name: bing-webmaster
description: Pull live Bing Webmaster Tools data for a site (clicks, impressions, top queries, top pages, crawl stats and crawl errors). Use when asked about Bing search traffic, Bing indexing or crawl health, or when a report needs a second search engine next to Google Search Console. Reads only. For Google see google-search-console.
metadata:
  version: 1.0.0
---

# Bing Webmaster Tools

## Access

- Credential: `BING_WEBMASTER_API_KEY`, from the user's secret store or environment (Bing Webmaster Tools → Settings → API access).
- Site: `BING_SITE_URL`, the verified site exactly as registered, e.g. `https://example.com/`.
- Network: `ssl.bing.com`.
- The key travels in the query string. Never echo the full request URL into logs, PRs, or messages.

## Run

```bash
scripts/bing.sh traffic   # GetRankAndTrafficStats: daily Clicks and Impressions
scripts/bing.sh queries   # GetQueryStats: Query, Clicks, Impressions, AvgImpressionPosition
scripts/bing.sh pages     # GetPageStats
scripts/bing.sh crawl     # GetCrawlStats: Code2xx/301/302/4xx/5xx, BlockedByRobotsTxt, timeouts
scripts/bing.sh GetUrlSubmissionQuota   # any other json.svc method that takes only siteUrl
```

Raw form: `GET https://ssl.bing.com/webmaster/api.svc/json/<Method>?siteUrl=<url-encoded site>&apikey=<key>`.

## Reading the response

- Payload is `{"d": [...]}`.
- Dates are `/Date(<ms since epoch>)/`. Convert before comparing windows.
- `traffic` returns roughly six months of daily rows. Filter client-side to the reporting window.
- `queries` rows are per query per date. Aggregate by query for a "top queries" list.
- `AvgClickPosition` of -1 means no clicks for that row.

## Rules

1. Report Bing next to Google, never merged into a single "search" total.
2. Crawl stats are the only crawl-health source among these data skills (Google's API has none). Flag rising 4xx, 5xx, or BlockedByRobotsTxt.
3. Bing's index and Google's index differ. Do not use Bing counts to reason about Google coverage.
4. Read live. No cached database, spreadsheet, or old post stands in for an API call.
5. Never print or commit the API key.
