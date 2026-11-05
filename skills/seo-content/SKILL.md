---
name: seo-content
description: How to decide on and write SEO/AEO content edits for a site's blog posts, docs pages and collection pages. Use before proposing or drafting copy for search or answer-engine visibility, when rewriting a page "for SEO" or "for AEO", when a Gauge Action Center item or GSC query suggests a content gap, or when reviewing an SEO copy PR. Covers demand-first scoping, the smallest-change ladder, fact verification, and rules for answer-first, low-hedge prose. Load after seo-aeo; ai-seo says how answer engines read pages, this skill says what to write and how much.
metadata:
  version: 1.0.0
---

# SEO/AEO content edits

Decide what to change from search demand and the page as it stands, make the smallest edit that answers the demand, verify every fact you touch, and write in the page's existing voice.

## Step 1: start from demand, not from a topic

1. Pull the page's queries from [`google-search-console`](../google-search-console/SKILL.md) for a 28 to 30 day window ending on a final date (page filter on the exact URL). Add Bing and Gauge prompts only if they bear on this page.
2. Write down the three to six questions those queries are actually asking. Branded and navigational queries count. A query with one impression is not demand.
3. Read the page on the default branch in full and mark each question as answered well, poorly, or not at all.
4. For a proposed new page, or a page with no GSC impressions, measure topic demand instead: sitewide `google-search-console` queries for the topic, Gauge keyword or prompt data, and which existing pages already rank for those queries.
5. If a Gauge Action Center item or a ticket proposes the topic, treat it as a hypothesis. Keep it only if step 1 shows demand for it on this page, or, for a proposed new page, step 4 shows topic demand that no existing page answers.

If you are reviewing someone else's SEO PR, do steps 1 to 3 before reading the diff. Form your own view first, then compare. Reading the diff first anchors you to its topic and structure.

## Step 2: pick the smallest change that closes the gap

Walk this ladder top down and stop at the first rung that answers the questions from step 1:

1. No change. The page already answers the demand. Say so.
2. Fix a fact. Out-of-date or wrong claims on the page. Fix these before writing new copy.
3. Edit a sentence in place. Answer the question in an existing paragraph, intro, FAQ answer, or meta description.
4. Retitle a heading as the question readers ask, and put the answer in its first sentence.
5. Add a FAQ entry, only for a question that recurs in the query data.
6. Add a section. Only when the query data shows the question recurring and no existing paragraph can carry the answer.
7. New page. Only when the demand is distinct from every existing page, the demand is measured, and no existing page ranks for it. Check scheduled posts too (future `date:` values are not live).

Do not add a competitor comparison section or "choose X when" table to a tutorial, announcement, or docs page. Comparison pages are a deliberate marketing decision, not a side effect of an SEO pass.

## Step 3: verify every fact you touch

- Check each claim you add or keep against repository code, the docs source, or the live product API (read-only `GET` endpoints). Record how you checked it.
- Fix wrong facts you find on the page even if they are not part of the SEO question.
- If you cannot verify a claim, drop it or leave the existing sentence alone. Do not replace an unverified claim with a hedge.
- Check links you touch. A `curl -s -o /dev/null -w "%{http_code}" -L <url>` per link is enough.
- Label verification honestly: read in code or docs, checked live with a GET, or not verified. Do not call static review end-to-end validation.

## Step 4: write it in the page's voice

Rules:

- Answer in the first sentence. Under a question heading, the first sentence is the answer, not "It depends on..." or context.
- Say what the product does. State the behavior positively. Do not stack "this is not X" sentences.
- One caveat per section at most. Keep a caveat if it changes what the reader does. Cut one that exists to protect the writer from a reviewer.
- About three links per paragraph at most. Link the one doc that answers the next question.
- Match the page. Keep its tense, person, sentence length, and point of view. Do not flatten opinionated lines into checklists of imperatives.
- Edit before you add. Rewrite an existing sentence before adding a new paragraph, and a paragraph before adding a section.
- Tables only for genuine comparisons of like things the reader is choosing between on this page.
- No em dashes, no marketing adjectives ("leading", "powerful", "seamless"), no year-stamped listicle titles.
- Final pass: delete any sentence whose removal would not change what the reader does.

Then run [`prose-pass`](../prose-pass/SKILL.md) (or [`humanizer`](../humanizer/SKILL.md) and [`unslop`](../unslop/SKILL.md)) over the prose you wrote. A clean pass is necessary, not sufficient. Over-hedging and overloaded paragraphs survive it.

## Examples

Fix the fact, keep the sentence. The old text was wrong, and the rewrite changes one clause.

```diff
- When a parcel exceeds the weight limit, the API returns a validation error.
+ When a parcel exceeds the carrier's weight limit, the API rejects the label request with a `422` whose error body names the limit and the parcel's weight.
```

Direct answer instead of hedges (FAQ).

```diff
- The `express` option speeds up delivery (it's roughly the same as picking the fastest carrier).
+ The `express` option sorts carriers by delivery time and adds overnight services to the quote.
```

One sentence of evidence instead of a paragraph of caveats (audit-trail section).

```diff
  A managed platform can quickly provide part of that evidence.
+ The [audit log](<docs link>) records the user, action, resource, and timestamp of each change, and [log export](<docs link>) sends it to your SIEM.
```

Say what the page shows instead of an unverifiable blanket claim (collection outro).

```diff
- Each one handles code generation, debugging, refactoring, and agentic coding workflows across popular languages and frameworks.
+ Each listing shows the model's context length and its input and output price per million tokens, so you can weigh cost against usage before you pick one.
```

## Server-rendered and translated copy

Copy rendered as product UI, or wrapped in the app's translation function, changes visible UI and the translation catalog when you edit it. Follow the repository's rules for server-rendered content: screenshots, a crawler check, and sign-off from the product or design owner for visible blocks. Update test snapshots that pin the old string.

## PR shape

- Batch related sentence-level fixes into one PR across pages. Do not open one PR per page for a sweep.
- PR description: per page, the demand it answers (query, impressions, position, window), the fact fixed and how it was verified, and anything left unverified.
- Record which Gauge prompt or GSC query motivated the change so the result can be re-measured after the crawl window.
