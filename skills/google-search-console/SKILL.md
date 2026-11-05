---
name: google-search-console
description: Pull live Google Search Console data for a site with a service account. Use when asked for Google clicks, impressions, CTR, average position, top pages or queries, week-over-week search deltas, sitemap status in Google, or URL index inspection. Reads only. For Bing see bing-webmaster; for GA4 see ga4; for AI-answer visibility see gauge.
metadata:
  version: 1.0.0
---

# Google Search Console

Read Search Console live over the API. There is no cached database or helper repo.

## Access

- Credential: `GSC_SERVICE_ACCOUNT_KEY`, service-account JSON whose `client_email` the property owner added as a user (Full or Restricted is enough for reads). Get it from the user's secret store or environment.
- Property: `GSC_PROPERTY`, e.g. `sc-domain:example.com` for a domain property or `https://example.com/` for a URL-prefix property. Ask the user if it is not set.
- Network: `oauth2.googleapis.com`, `www.googleapis.com`, `searchconsole.googleapis.com`.
- Never print the key or the minted access token.

## Run

`scripts/gsc.py` mints the token and calls the API. Needs `python3` and `openssl`.

```bash
python3 scripts/gsc.py totals  2026-08-04 2026-08-31         # site totals, no dimensions
python3 scripts/gsc.py dates   2026-08-25 2026-09-12         # daily series; last row = latest final date
python3 scripts/gsc.py pages   2026-08-04 2026-08-31 20      # top pages by clicks
python3 scripts/gsc.py queries 2026-08-04 2026-08-31 20      # top queries by clicks
python3 scripts/gsc.py page-queries 2026-08-04 2026-08-31 https://example.com/pricing 20
python3 scripts/gsc.py sitemaps
python3 scripts/gsc.py inspect https://example.com/some/path
python3 scripts/gsc.py raw '{"startDate":"...","endDate":"...","dataState":"final","dimensions":["country","device"],"rowLimit":50}'
```

Without the script: sign a JWT with the JSON's `private_key` (RS256, `iss` = `client_email`, `scope` = `https://www.googleapis.com/auth/webmasters.readonly`, `aud` = `https://oauth2.googleapis.com/token`, 1 hour expiry), exchange it at `POST https://oauth2.googleapis.com/token` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`, then call `POST https://www.googleapis.com/webmasters/v3/sites/<url-encoded property>/searchAnalytics/query`.

## Rules

1. Site totals come from a query with no dimensions. Never sum page or query rows and present the sum as a sitewide number.
2. Use `dataState: final` for any delta or comparison. Data lags 1 to 3 days. Run `dates` first, end every window at the latest final date, and state that date in the output.
3. Comparison windows must be the same length and both end on final dates.
4. The API does not expose Crawl Stats, Core Web Vitals, manual actions, or security issues. Say "not available via API" rather than approximating.
5. Search type defaults to web. Pass `"type": "image"` or `"news"` through `raw` when asked.
6. Read live. No cached database, spreadsheet, or old post stands in for an API call. Label every number as GSC and never merge it with Bing or GA4 into one total.
7. Never print or commit the service-account key or a minted access token.

## Typical outputs

- Weekly report: totals for window and prior window, top 10 pages and queries with change, latest final date.
- Page diagnosis: `page-queries` for the URL plus `inspect` for index status and canonical.
- Sitemap check: `sitemaps` for last download, warnings, errors, submitted vs indexed counts.
