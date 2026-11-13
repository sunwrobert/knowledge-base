---
name: council-devin
description: >-
  Devin's council, replacing upstream tstack `council` (needs T3 Code's `orchestrator_capabilities` and `delegate_task`): three read-only child Devin sessions on Opus 5.5, Sol 6.1 and GPT-6 Astra via `devin_session_create`'s `devin_mode`, never a model API, returning findings, disagreements, recommendations and a score out of 10, repeated after fixes. Use for "/council", "council review" or "ask the council".
metadata:
  version: 1.4.0
  adapted-from: https://github.com/t3dotgg/tstack/blob/1085050f3baed1ac724caa4a8166145fb2ac88af/skills/council/SKILL.md
---

# council-devin

Before the audit, address outstanding PR comments, fix known issues, and run relevant checks, so the council sees the updated code. If the user is discarding the implementation to explore new ideas, skip fixes to code being replaced.

## Members

`devin_mode` is batch-level, so make one `devin_session_create` call per member, all three concurrently from one `scripted_tools` script, each call's error kept separate.

| Delegate    | `devin_mode`  |
| ----------- | ------------- |
| Opus 5.5    | `opus-5-5`    |
| Sol 6.1     | `gpt-6-1-sol` |
| GPT-6 Astra | `gpt-6-astra` |

- The schema and the 422 for an unknown `devin_mode` list only the eight picker modes (`normal` ... `swe-2-max`), but the server accepts these IDs from `scripted_tools`. Rejected near spellings: `gpt-6.1-sol`, `sol-6-1`, `claude-opus-5-5`.
- Use members the user names instead. Report a failed create with its error, never a substitute.
- Never call an API router or a model API directly. A child can't name its own model, so the accepted `devin_mode` is the evidence: record it.
- Two OpenAI members is deliberate, overriding upstream's one-per-provider rule.

## 1. Brief

One brief, identical for every delegate:

- The request; for a review: repo, branch, PR URL, base, and the exact diff command (`git diff <base>...HEAD -- <paths>`).
- Intent and out of scope in 1-2 sentences, and checks already run. Out of scope and the score's target are the user's words, never a lower bar you pick.
- Read-only: check out and read; no edits, commits, pushes, PRs, PR comments, Slack messages, or child sessions.
- For a code review: findings as `id, severity (blocker|should|nit), file:line, evidence, smallest fix`, then disagreements with the brief, then `SCORE: <n>/10`.

## 2. Start the round

Per member: `devin_session_create` with `devin_mode`, `repos` = the repo, `title` `Council <delegate> round <n>: <change>`, `notify_on_response=true`, and this `structured_output_schema`:

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

When each child notifies you, read `structured_output` once with `devin_session_interact` `get` (its last messages if output is missing). Verify every finding against the code before acting.

## 3. Collect

Report: findings that hold up (merged, noting who raised each), rejected findings with reasons, disagreements between delegates, and next steps. No score returned means `no score`.

## 4. Later rounds

One full review pass is one round. After making the changes you agree with, message the same three sessions with `devin_session_interact` `message`: the change since last round and open finding ids, asking each to mark them `resolved` or `still open: <reason>` and re-score. Repeat until every agreed finding at every severity is fixed or refuted with evidence; "no blockers" is not done. Decline out-of-brief findings and say so.

## 5. Report

With a PR, put this section in its description via `git_update_pr`, above Devin's session link (not a comment):

```markdown
## Council review

Rounds: 2

| Delegate | Round 1 | Round 2 |
| --- | --- | --- |
| Opus 5.5 | 7/10 | 9/10 |
| Sol 6.1 | 8/10 | 10/10 |
| GPT-6 Astra | 7/10 | 9/10 |
```

Link each delegate's child sessions. Without a PR, put it in the final reply. Archive the delegate sessions when done.
