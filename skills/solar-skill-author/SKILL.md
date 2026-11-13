---
name: solar-skill-author
description: >-
  Write or shrink an agent skill, prompt, AGENTS.md, or REVIEW.md to the shortest text that still changes the agent's behavior, by naming each idea with the field's own term. Use for "/solar-skill-author", "write a skill", "shrink this skill", or "tighten this prompt".
metadata:
  version: 1.1.0
---

# Solar skill author

The best prompt is the shortest one that names the idea with its term of art. A term of art carries everything the model knows about it; a definition you write carries only what you wrote.

## Good prompts

- `find all of the implicit state machines in my app` ([Steve Ruiz](https://x.com/steveruizok/status/2116552016218710389)). "Implicit state machine" carries modes, transitions, impossible states, and booleans that move together.
- `fricative` ([Matt Pocock](https://x.com/mattpocockuk/status/2115023694942662985)). One phonetics word made the agent bring out the IPA and list the consonants that break silence detection.
- `this codebase is yours`. Ownership in four words: the agent fixes root causes, deletes dead code, and leaves the code better than it found it.

## Procedure

1. State the behavior in one sentence. If it needs two, the skill is two skills.
2. Replace each paragraph with the term an expert in that field would use for it (`idempotent`, `blast radius`, `make illegal states unrepresentable`, `tracer bullet`). Coin a term only when the field has none, and define it once.
3. Ablate: delete every sentence without which the agent would act the same.
4. Say what to do, not what to avoid. Keep a ban only as a guardrail no instruction can express, paired with the instruction.
5. Keep each rule in one place; link to the skill that owns it.
6. The description loads every turn: what the skill does, then one trigger per distinct case, synonyms collapsed.
7. Run [`unslop`](../unslop/SKILL.md) over the result.

## Done means

Every sentence changes the agent's behavior, and every idea with a term of art uses it. Work shipped in a PR has the before/after byte count in its body.
