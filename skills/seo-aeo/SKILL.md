---
name: seo-aeo
description: Entry point for any SEO, AEO, GEO, or search-visibility task on a site. Read this first, then load only the skills it routes you to. It covers generic methodology (seo, seo-audit, ai-seo, programmatic-seo), content writing (seo-content), live data (google-search-console, bing-webmaster, gauge, ga4) and coding-agent preference measurement (gauge-cli), and sets the shared rules for windows, sources, write gates and reporting. Use when asked to audit, report on, improve, or change anything about a site's Google/Bing rankings, AI-answer citations, GA4 traffic, sitemap, metadata, llms.txt, or structured data, or when the request just says "SEO" or "AEO" without saying which part.
metadata:
  version: 1.1.0
---

# SEO / AEO router

This skill is a router. It does not repeat the other skills; it tells you which ones to load, in what order, and the rules that apply across all of them. Load each by reading its `SKILL.md` and following it.

## Inputs

- Target site (domain and canonical origin), from the user or the repository.
- The repository that serves it, if code changes are in scope. Read its agent guidance and SEO conventions before touching a file.
- Property IDs and credentials for each data source, from the environment. Each data skill names the variables it reads.
- Where findings and reports go (tracker, channel), if the user names one.

## Step 1: classify the request

Pick every row that matches. Most real requests match two or three.

| Request looks like                                                                                                                              | Load, in order                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Google clicks/impressions/position, top pages or queries, index status, Bing traffic or crawl health                                            | [`google-search-console`](../google-search-console/SKILL.md), [`bing-webmaster`](../bing-webmaster/SKILL.md)                             |
| "How is SEO doing", weekly SEO or SEO/AEO report                                                                                                | `google-search-console`, `bing-webmaster`, [`gauge`](../gauge/SKILL.md), [`ga4`](../ga4/SKILL.md)                                        |
| Weekly AEO report, AI citations, ChatGPT/Perplexity/Gemini/Claude visibility, share of voice, competitors in AI answers, topics, Action Center  | `gauge`                                                                                                                                  |
| Site traffic, sessions, channel split, AI referral traffic, landing pages                                                                       | `ga4`                                                                                                                                    |
| Keyword volume, difficulty, organic keywords for a domain or URL                                                                                | `gauge` (keyword research tools)                                                                                                         |
| Which packages or brands coding agents install, agent preference, evals of the site's docs or skills, docs or skill optimization trials         | [`gauge-cli`](../gauge-cli/SKILL.md)                                                                                                     |
| Technical audit, "why did traffic drop", crawl or indexing problems, Core Web Vitals, page speed, metadata review                               | [`seo-audit`](../seo-audit/SKILL.md)                                                                                                     |
| Improve rankings, fix meta tags, add structured data, sitemap change, canonical question, internal linking                                      | [`seo`](../seo/SKILL.md)                                                                                                                 |
| Write or rewrite page copy for SEO/AEO (blog, docs, collection intros, FAQs, meta descriptions), act on a content gap, or review an SEO copy PR | [`seo-content`](../seo-content/SKILL.md), `google-search-console` for the page's queries                                                 |
| Get cited by AI, llms.txt, agent-readable pages, answer-engine content structure, AI Overviews                                                  | [`ai-seo`](../ai-seo/SKILL.md), then `gauge` to measure before and after                                                                 |
| Many templated pages (catalog, comparison, integration pages), pages at scale                                                                   | [`programmatic-seo`](../programmatic-seo/SKILL.md), `seo`                                                                                |
| Vague: "help with SEO", "look at our SEO"                                                                                                       | Start with `seo-audit` for the method and `google-search-console` + `gauge` for the current numbers, then ask which lever the user wants |

Precedence when skills overlap: the repository's own SEO conventions override the generic skills (`seo`, `seo-audit`, `ai-seo`, `programmatic-seo`). The generic skills say how SEO works in general; the repository says how it is done there. If a generic skill suggests an action the repository forbids (hand-editing SEO baselines, changing canonical policy, adding a page without a sitemap entry), the repository wins.

## Step 2: load the skills

Read each routed `SKILL.md` fully before running any of its commands. Each data skill names its own credential, network hosts, and helper script; do not substitute one skill's credential or endpoint for another's.

Skill map:

- `seo` - generic search engine optimization: metadata, structured data, sitemaps, ranking factors.
- `seo-audit` - technical and on-page audit method, ranking-drop triage, CWV, crawl and indexing diagnosis.
- `ai-seo` - AEO/GEO/LLMO: how to get cited by AI answer engines, llms.txt, agent-readable content.
- `programmatic-seo` - template-driven pages at scale, data-driven page generation, thin-content avoidance.
- `seo-content` - what content to write and how much: demand-first scoping, the smallest-change ladder, fact verification, and rules for answer-first, low-hedge prose.
- `google-search-console` - Google Search Console for the configured property (`GSC_PROPERTY`, `GSC_SERVICE_ACCOUNT_KEY`).
- `bing-webmaster` - Bing Webmaster Tools for the configured site (`BING_SITE_URL`, `BING_WEBMASTER_API_KEY`).
- `gauge` - Gauge MCP at `app.withgauge.com/mcp` (`GAUGE_API_KEY`): AEO visibility, citations, topics, competitors, keyword research, Action Center, GA4.
- `ga4` - GA4 recipes, directly or through Gauge's `run_ga4_report`.
- `gauge-cli` - Gauge's `@withgauge/cli` (`GAUGE_API_TOKEN`): coding-agent preference and install share, eval sets, runs, docs and skill optimizations. Different product surface and credential from the MCP skill.

## Shared rules

These apply on top of whatever the loaded skills say.

1. Live data only. Every number comes from the API at the time of the request. No cached databases, no numbers copied from older posts or reports when the source can return the window.
2. Same-length windows that both end on a final date. GSC lags 1 to 3 days; Gauge and GA4 have their own lag. State every window's date range and each source's latest final date in the output.
3. Never merge sources. Google, Bing, Gauge, and GA4 are reported side by side, each labeled with its source. Site totals come from undimensioned queries, never from summing rows.
4. A period-over-period AEO comparison is only valid when both windows are pulled from Gauge in the same call set with the same category and tracking type. Flag any comparison that spans a change in tracked prompts, topics, or competitors.
5. Reads by default. Gauge MCP writes, Gauge CLI launches that spend credits, tracker writes, and chat posts each need explicit confirmation from a human in the current conversation. Scheduled or automated runs never open a write gate on their own.
6. Code changes follow the repository's agent guidance and SEO conventions. Run its SEO checks and look at its SEO CI results, if any, before reporting site health.
7. Secrets stay out of output. Never print, log, commit, or paste service-account keys, API keys, tokens, minted access tokens, or request URLs that carry a key.
8. Tie work to tracking when the user names a tracker. Say "no ticket" rather than guess. If reports go to a channel, read its recent posts first so framing and numbers stay consistent.
9. Quote each source as itself. "Gauge reports X", "GSC reports Y". Do not restate a Gauge visibility score as a ranking or a GSC position as AI visibility.

## Typical flows

Weekly SEO/AEO report: `google-search-console` (`dates` first, then totals, pages, queries for both windows) -> `bing-webmaster` (traffic, crawl) -> `gauge` (`list_categories`, then performance over time for both windows, topics, competitors, actions) -> `ga4` (channel split, AI referrals) -> latest SEO CI runs if the repository has them. Draft, then confirm before posting.

Ranking or traffic drop: `seo-audit` method -> `google-search-console` to locate the drop by date, page, and query -> `bing-webmaster` to see if Bing moved too -> the repository's recent SEO-relevant commits and CI results around the drop date -> `ga4` to confirm impact on sessions.

Improve AI citations for a topic: `gauge` baseline (topic detail, cited domains and pages, prompt answers) -> `ai-seo` for content and structure changes -> `seo-content` for what to write and how much -> ship via PR -> re-measure with the same Gauge calls after the crawl window.

New templated page family: `programmatic-seo` for template and data rules -> `seo` for metadata and structured data -> the repository's sitemap, canonical and metadata conventions -> `google-search-console` and `gauge` for keyword and topic demand to prioritize.

Coding-agent preference or docs/skill effectiveness: `gauge-cli` (`gauge instructions` first, reads with `-o json`) -> report measured results with sample counts -> if an optimization is wanted, author one trial per variable and get confirmation before any launch that spends credits.

## Output checklist

Before sending a report or opening a PR, confirm: every number has a source and a date window, windows are the same length and end on final dates, no source is merged into another, Gauge comparisons note cohort caveats, no secret or keyed URL appears anywhere, write gates were opened by a human, and code changes passed the repository's SEO checks.
