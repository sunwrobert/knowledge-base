---
name: gauge
description: Pull live Gauge (app.withgauge.com) data for a brand over its MCP endpoint. Gauge is a source for AEO metrics (AI answer-engine visibility, citation rate, mention rate, share of voice, topics, prompts, competitors, cited domains and pages), the Action Center, keyword research (organic keywords, search volume, difficulty), and GA4 when the workspace has it connected (run_ga4_report, get_SEO_overview). Use when asked about AI citations, ChatGPT/Perplexity/Gemini visibility, competitors in AI answers, GA4 sessions or AI referral traffic through Gauge, or keyword volume. Reads by default; writes need explicit human confirmation.
metadata:
  version: 1.0.0
---

# Gauge (AEO visibility, GA4, keyword research)

This is Gauge's MCP surface for AI answer-engine visibility. Gauge's `gauge` CLI (`@withgauge/cli`) is a separate product surface for coding-agent preference, evals, and optimizations with its own `GAUGE_API_TOKEN`; see [`gauge-cli`](../gauge-cli/SKILL.md). The two credentials are not interchangeable.

## Access

- Credential: `GAUGE_API_KEY`, from the user's secret store or environment.
- Endpoint: `https://app.withgauge.com/mcp` (override with `GAUGE_MCP_URL`), bearer auth, stateless JSON-RPC over HTTP. No initialize handshake.
- Network: `app.withgauge.com`.

## Run

```bash
scripts/gauge.sh tools                                   # tool catalog with schemas
scripts/gauge.sh call list_categories '{}'               # ALWAYS first; take the id for the user's brand category
scripts/gauge.sh call <tool> '<json arguments>'
```

Raw form: `POST https://app.withgauge.com/mcp` with headers `Authorization: Bearer <key>`, `Content-Type: application/json`, `Accept: application/json, text/event-stream`, body `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}`.

Results arrive as `result.content[0].text`, a JSON or CSV string. Parse it.

## Rules

1. Call `list_categories` first and use the returned `id` for the category whose `default_brand_name` is the user's brand. Never hardcode a category id. Ask if more than one matches.
2. Read-only by default. The tools below marked WRITE change Gauge state and need explicit confirmation from a human in the current conversation before each call.
3. `tracking_type` is `"visibility"` for AEO metrics unless told otherwise.
4. `run_ga4_report` requires every key in its schema: `dimensions`, `metrics`, `start_date`, `end_date`, `dimension_filters` (`[]` when unused), `filter_logic` (`"and"`), `order_by` (`""` when unused), `limit`, `property_id` (`null` for the default property). Omitting any of them fails validation.
5. Quote Gauge numbers as Gauge's. Do not derive history from old posts when Gauge can return the window.
6. Never print or commit `GAUGE_API_KEY`.

## Read tools

AEO visibility

- `get_category_overview` `{category_id}`: visibility, trends, topics, top cited domains in one call.
- `get_performance_over_time` `{start_date,end_date,category_id,tracking_type}`: daily visibility and citation rate.
- `get_brand_visibility_over_time` same plus optional `brand_id`.
- `list_topics` `{category_id,start_date,end_date,tracking_type}`; `get_topic_detail` `{category_id,topic_slug,...}`; `get_topic_keywords` `{category_id,topic_slug}`.
- `list_domains`, `list_pages` `{category_id,start_date,end_date,...}`: who gets cited, which URLs.
- `get_prompts` `{category_id}`; `get_prompt_answers` `{category_id,prompt_id,...}`; `get_answer` `{answer_id,category_id}`.
- `list_competitors` `{}`; `search_brand_by_name` `{brand_name,category_id}`.
- Optional `model` filters to one answer engine.

GA4 and SEO overview

- `get_SEO_overview` `{start_date,end_date}`: GA4 traffic by source, AI referral traffic, GSC summary.
- `run_ga4_report` `{dimensions,metrics,start_date,end_date,dimension_filters,filter_logic,order_by,limit,property_id}`: any GA4 Data API report. Recipes in [`ga4`](../ga4/SKILL.md). Sessions from AI referrers: dimensions `["sessionSource"]`, metrics `["sessions","totalUsers"]`.
- `run_gsc_report` `{dimensions,start_date,end_date,dimension_filters,search_type,limit}`: Gauge's GSC copy. Prefer [`google-search-console`](../google-search-console/SKILL.md) for authoritative Google numbers.

Keyword research

- `get_domain_organic_keywords` `{domain,limit,sort_by,min_position}`; `get_url_organic_keywords` `{url}`; `get_keyword_overview` `{keywords}`.

Action Center and library

- `list_actions` `{category_id,status:["to_do","in_progress"],page,page_size}`; `get_action` `{action_id}`.
- `list_library_content`, `check_content_coverage` `{topics}`, `get_library_content`.
- `get_usage_limits` `{}` shows tracked-prompt quota. Check before proposing new prompts.
- `ask_gauge` `{prompt}` for multi-source questions when a direct tool does not fit.

## WRITE tools (human confirmation required)

`create_topic`, `create_prompts`, `generate_prompts`, `add_keywords_to_topic`, `remove_keywords_from_topic`, `update_keywords_for_topic`, `move_prompts`, `create_tag`, `apply_tag_to_prompts`, `remove_tag_from_prompts`, `create_content_artifact`, `update_brief`, `update_outline`, `edit_article`, `research_topics`, `update_research_context`, `generate_outline`, `write_article`, `review_article`, `update_action_status`, `set_action_due_date`, `assign_action`, `create_action`, `open_action_chat`, `edit_memory_file`, image upload tools.

## Typical outputs

- Weekly AEO report: performance over time for window and prior window, topics with largest citation-rate drop, competitor moves, open Action Center items.
- AI referral traffic: `run_ga4_report` filtered to sessionSource in chatgpt.com, perplexity.ai, gemini.google.com, claude.ai, copilot.microsoft.com.
- Content gap: `list_topics` with zero citations for the brand and high prompt volume, cross-checked with `check_content_coverage`.
