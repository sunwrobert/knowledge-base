---
name: earn-its-keep
description: >-
  Cost-benefit verdict (keep, shrink, or delete) on a file, abstraction, dependency, test, flag, config, CI step, automation, skill, doc, or PR, from code and production evidence. Read-only unless asked to apply. Use for /earn-its-keep, "does this earn its keep", "is this truly necessary", "is this worth it", "what does this add", or "can we delete this".
metadata:
  version: 0.4.0
  disable-model-invocation: true
---

# earn-its-keep

Chesterton's fence, then make the fence pay rent. Argument: one or more targets; one verdict each.

1. **Claim.** What it buys, in one sentence, from its code, PR body, commit, or docs, else "none found".
2. **Evidence.** Prove the claim from the artifact, never its name or comments:
   - Reachability: callers and importers (`rg`, the type checker, `knip`), plus invokers of an entry point (workflow and cron config, `package.json` scripts, route tables, deploy config, traffic or run logs). Dead only when both are empty.
   - Ablation: delete or bypass it on a scratch branch; run the tests and the flow it guards.
   - Production: the metric, log, or event it moves (Datadog, ClickHouse, PostHog), with number and window.
   - Tests: [**principle-test-behavior-not-implementation**](../principle-test-behavior-not-implementation/SKILL.md).
   - Automations and skills: runs, PRs, or corrections in the last 30 days.
3. **Carrying cost.** Lines, files, dependencies and install size, CI minutes, indirection, ACUs per run, tokens per load, and bugs or reverts it caused (`git log` with a pathspec).
4. **Cheaper option.** An existing platform API, helper, lint rule, or skill that does the job, with a path or link.
5. **Verdict.** `keep` (evidence beats cost, no cheaper option), `shrink: <part to cut>`, or `delete` (no evidence, or a cheaper option does the job; name the replacement or "nothing").

## Reply

1. Verdict per target, on the first line.
2. A fenced `diff` block: `+` what it buys, `-` what it costs, each with number and source.
3. The cheaper option, or "none".
4. What shrinking or deleting breaks, from the ablation, or "Not run".

Applying `shrink` or `delete` goes through [**ship-with-proof**](../ship-with-proof/SKILL.md).
