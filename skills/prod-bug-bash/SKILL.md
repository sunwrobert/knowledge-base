---
name: prod-bug-bash
description: "Run a read-only exploratory bug bash against a production web app with TesterArmy's `e2e explore` (focused charters, signed out and signed in), check every raw finding by hand, and report confirmed, rejected, intended and unchecked findings with cost and coverage. Use for a scheduled bug-bash automation, or when asked to 'run e2e explore', 'bug bash prod' or 'find UI bugs the smoke tests miss'. Confirmed bugs are fixed through the ship-with-proof skill."
---

# Prod bug bash with `e2e explore`

An AI agent drives a real browser through the target site, one focused goal (charter) per run, and reports things that look broken. Treat its output as leads, not bugs. Nothing is filed or fixed until you reproduce it yourself.

## Inputs

- Target URL, from the user or the repository's docs.
- The repository that owns the site, for root-causing.
- For signed-in charters: a dedicated test account and where its credentials live (the user's secret store or environment). Never ask for or use a personal account.

## Setup (outside any repo)

1. Make a standalone project. Never add `e2e` to the product repository.

   ```bash
   mkdir -p ~/e2e-explore && cd ~/e2e-explore
   printf '{"name":"e2e-explore","private":true,"type":"module"}\n' > package.json
   npm i e2e @e2e-dev/web <ai-sdk-provider-package>
   export E2E_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
   ```

2. Use the AI SDK provider the user has a key for (e.g. `@ai-sdk/anthropic` with `ANTHROPIC_API_KEY` set). Write `e2e.config.ts`:

   ```ts
   import type { E2EConfig } from 'e2e';
   import { web } from '@e2e-dev/web';
   import { anthropic } from '@ai-sdk/anthropic';

   export const engine = web();
   const agent = (id: string) => ({ model: anthropic(id), maxInputTokens: 200_000 });

   export default {
     agents: { default: agent('<current Sonnet-class model id>') },
     targets: [{ name: 'prod', engine, app: { url: '<target URL>' } }],
   } satisfies E2EConfig;
   ```

   - Use a current Sonnet-class model. Cheaper models (Haiku-, Flash- or mini-class) produce mostly false positives or get stuck. Check that the model id is live first and name it in the report.
   - Keep `maxInputTokens: 200_000`. The 64k default ends content-heavy page runs after a couple of steps.
   - To evaluate a different model, add it as a named agent and run the same signed-out charters with `--agent <name>`, then verify and score its findings the same way.

## Charters

Run one exploration per charter, each with its own `--output` directory, **at most 4 at once**. More parallel browsers crash with "Target crashed". Use `--max-steps 12 --timeout 900000`.

Derive charters from the site's main surfaces, one surface per charter, each naming the concrete controls to exercise: search, every filter and sort order, list and table views at 1280px, time ranges, charts, detail-page links, docs and code samples, interactive playgrounds. Split signed-out from signed-in surfaces. Typical signed-in charters cover account resources (lists, search, empty states, tooltips), billing views, activity or logs, and settings.

End each goal with: "Report only behavior you observed. Before reporting missing text, read the element's full text including link text. Before reporting a link that doesn't navigate, check its `target` attribute and any new tab."

```bash
npx e2e explore --target prod --max-steps 12 --timeout 900000 --reporter json --output bb/<charter> "<charter text>"
```

### Signing in

With Playwright outside the repo, drive the site's real login flow for the test account (including any SSO hand-off: wait for the identity provider's host, fill its fields, wait to land back on the target). Save storage state to a temp file, convert cookie `expires` to integer seconds (drop `-1`), and pass it to the signed-in runs. Delete the file when done. Never print credentials.

### Read-only rules

Never sign up, send messages, create, delete or rotate credentials, buy anything, connect integrations, invite users, or change settings. Say this in every signed-in charter.

## Verify every finding

For each finding in `bb/*/report.json` (`run.explore.findings`), reproduce it yourself in a real browser at the same URL, viewport and state, and classify it:

- **confirmed**: you reproduced it and it is wrong per the product, the code or the docs.
- **rejected**: you couldn't reproduce it, or the agent misread the page.
- **intended**: reproduced, but it is designed that way. Cite the code.
- **unchecked**: needs an account state, data or access you don't have. Say why.

The agent also files placeholder findings and findings whose own text says "not a defect". Reject those without reproducing.

Check these known false positives first:

- **"Sentence is missing its linked text"**: the agent drops text inside `<a>`. Compare against `element.textContent`.
- **"Link doesn't navigate / only adds #section"**: the link has `target="_blank"` or a named target and opened a new tab. A hash on the original tab often comes from section-nav scroll spy. Check `target` and `context.pages()`.
- **"Shows Sign Up while signed in"** and **"page is blank"**: usually a screenshot taken mid-hydration. Reload and wait.
- **Numbers differ between views**: check that both views cover the same time period before calling it a bug.
- **Feature X is missing**: the agent sometimes invents an expected feature. Confirm the product ever offered it.

For a confirmed bug, find the root cause in code before reporting. When several findings share a cause, report them as one bug.

## Report

Lead with the confirmed bugs (URL, steps, expected, actual, root-cause file), then:

- Rejected, intended and unchecked findings, one line each with the reason.
- Coverage gaps: charters that stopped early, crashed or hit limits.
- Totals: model, charters, wall time, model cost (`run.usage.estimatedCostUsd` in each report), raw findings, and the confirmed share.

## Fixing

Fix only confirmed bugs, each through the [`ship-with-proof`](../ship-with-proof/SKILL.md) skill, one PR per root cause. Search for an open PR or a fix on the default branch first. Bugs on surfaces another repository owns (a separately hosted docs site, for example) belong there: report them, don't patch them in the wrong repo.
