---
name: council-devin
description: >-
  Devin's council. In Devin, use this instead of the upstream tstack `council` skill, which depends on T3 Code's `orchestrator_capabilities` and `delegate_task`. Brings in three read-only delegates, each a child Devin session started on its own model (Opus 5.5, Sol 6.1, GPT-6 Astra) through `devin_session_create`'s `devin_mode` (Devin's native model selection, not an API router), collects findings, disagreements, recommendations and a score out of 10, and repeats rounds after fixes. Use when the user says "council", "/council", "council-devin", "council review" or "ask the council".
metadata:
  version: 1.0.0
  adapted-from: https://github.com/t3dotgg/tstack/blob/1085050f3baed1ac724caa4a8166145fb2ac88af/skills/council/SKILL.md
---

# council-devin

Before an audit, address outstanding PR comments, fix known issues, and run relevant checks. Give the council the updated implementation; do not defer known fixes until reviews return. If the user wants to discard the implementation and explore new ideas, skip fixes to code being replaced.

## Members

Each delegate is a child Devin session. The model is set by `devin_mode`, which is batch-level, so start one `devin_session_create` call per member and launch the three concurrently from one `scripted_tools` script, keeping each call's error separate so a failed member is reported on its own.

| Delegate    | `devin_mode`  |
| ----------- | ------------- |
| Opus 5.5    | `opus-5-5`    |
| Sol 6.1     | `gpt-6-1-sol` |
| GPT-6 Astra | `gpt-6-astra` |

- The tool schema and the 422 for an unknown `devin_mode` list only the eight picker modes (`normal` ... `swe-2-max`); the server accepts these model IDs anyway when they are passed as `devin_mode` from a `scripted_tools` script. Near spellings are rejected: `gpt-6.1-sol`, `sol-6-1`, `claude-opus-5-5`.
- If the user names other members, use those. If a member's create call fails, report it with the error and do not substitute another model.
- Use Devin's native model selection; never call an API router or any model API directly for the council. A child session cannot name its own model, so the evidence for which model ran is the `devin_mode` the create call accepted; record it.
- Sol and Astra are both OpenAI. This lineup deliberately overrides upstream's one-model-per-provider rule.

## 1. Brief

Write one brief, the same for every delegate:

- The request, and for a review: repo, branch, PR URL, base, and the exact diff command (`git diff <base>...HEAD -- <paths>`).
- Intent and out of scope in 1-2 sentences, and the checks already run.
- Read-only: clone or check out and read; no edits, commits, pushes, PRs, PR comments, Slack messages, or child sessions.
- For a code review: findings as `id, severity (blocker|should|nit), file:line, evidence, smallest fix`, then disagreements with the brief, then `SCORE: <n>/10`.

## 2. Start the round

Call `devin_session_create` once per member with `devin_mode` set, `repos` set to the repo, `title` `Council <delegate> round <n>: <change>`, `notify_on_response=true`, and this `structured_output_schema`:

```json
{
  "type": "object",
  "required": ["findings", "score"],
  "properties": {
    "findings": {"type": "array", "items": {"type": "object", "required": ["id", "severity", "location", "evidence", "fix"], "properties": {"id": {"type": "string"}, "severity": {"enum": ["blocker", "should", "nit"]}, "location": {"type": "string"}, "evidence": {"type": "string"}, "fix": {"type": "string"}}}},
    "disagreements": {"type": "array", "items": {"type": "string"}},
    "recommendations": {"type": "array", "items": {"type": "string"}},
    "score": {"type": ["integer", "null"], "minimum": 0, "maximum": 10}
  }
}
```

Do not poll. When each child settles, read `structured_output` once with `devin_session_interact` `get`, and its last messages if the output is missing. Treat it as a claim: check every finding against the code before acting on it.

## 3. Collect

Summarize for the user: findings that hold up (merged across delegates, noting who raised each), findings you reject with the reason, disagreements between delegates, and recommended next steps. A delegate that returns no score gets `no score`; do not invent one.

## 4. Later rounds

Count each full review pass as one round. If you agree with the recommendations, make the changes, then start a fresh round: message the same three sessions with `devin_session_interact` `message` (same session, same model), giving the change since last round and the open finding ids, and ask each to mark them `resolved` or `still open: <reason>` and re-score. Continue until all delegates are satisfied. Keep scope limited: decline findings outside the brief and say so.

## 5. Report

If the work ends in a pull request, put this section in the PR description with `git_update_pr`, above the session link Devin appends. Edit the description; do not post a comment.

```markdown
## Council review

Rounds: 2

| Delegate | Round 1 | Round 2 |
| --- | --- | --- |
| Opus 5.5 | 7/10 | 9/10 |
| Sol 6.1 | 8/10 | 10/10 |
| GPT-6 Astra | 7/10 | 9/10 |
```

Link each delegate's child sessions. If there is no PR, put the same results in the final reply only. Archive the delegate sessions when the council is done.
