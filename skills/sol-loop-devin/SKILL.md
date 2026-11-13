---
name: sol-loop-devin
description: >-
  Devin's Sol review loop, replacing upstream tstack `sol-loop` (needs T3 Code's `delegate_task`): one read-only GPT Sol reviewer as a native Devin child session (`devin_mode` `gpt-6-1-sol`), never a model API, reviews a change before or after its PR with a fixed round budget, a severity ledger, and the smallest fix per agreed finding. Use for "/sol-loop", "sol loop", or "review this with Sol".
metadata:
  version: 2.3.0
  adapted-from: https://github.com/t3dotgg/tstack/blob/1085050f3baed1ac724caa4a8166145fb2ac88af/skills/sol-loop/SKILL.md
---

# sol-loop-devin

Make the smallest change that satisfies Sol, and push back on wrong findings.

## Budget

- 3 rounds. Round 1 is full; later rounds check only changed code and open findings.
- Extend to 5 only when the user asks, or for security, permissions, auth, data loss, or state/concurrency while a blocker or should stays open with evidence.
- Stop early on a nit-only round. Declined nits and comment, doc, or format-only fixes need no new round.
- One reviewer: the same read-only Sol child session every round, never a second child or a testing agent.
- Ledger: id, severity, outcome, round. Never guess it.

## 1. Scope

Run `git status --short`. Never stash, discard, or include unrelated changes. Limit review to the change paths if they separate cleanly; otherwise ask with `message_user`.

Base, after `git fetch origin`:

- PR: read `baseRefName` and head SHA with `git_view_pr` (or `GH_REPO=<owner>/<repo> gh pr view <url> --json baseRefName,headRefOid`; the remote is a proxy). Check out the branch only if clean. `HEAD` must be the PR head or ahead only by this change. Base: `git merge-base HEAD origin/<baseRefName>`.
- Local: `git merge-base HEAD origin/<default-branch>`. If the change must stay unpublished or there's no remote, stop and tell the user; push only with explicit permission.

The child reads only the remote: before round 1, commit and push whatever part of the scoped change is unpushed (untracked files included), and confirm the remote head equals `HEAD`.

Use one diff command (base to pushed head, in those paths) for all rounds. State intent and out of scope in 1-2 sentences. Run covering checks and fix what the change breaks before sending. Note missing or pre-failing checks in the brief.

## 2. Start Sol

Start Sol the way [`council-devin`](../council-devin/SKILL.md) starts its Sol member: one `devin_session_create` from a `scripted_tools` script.

- `devin_mode`: `gpt-6-1-sol`. The schema and the 422 list only picker modes, but the server accepts this ID from `scripted_tools`; `gpt-6.1-sol` and `sol-6-1` are rejected. Use another Sol ID only if the user names one.
- `repos`: the repo, `title`: `Sol review round 1: <change>`, `notify_on_response=true`, `prompt`: the round 1 brief.
- `structured_output_schema`:

```json
{
  "type": "object",
  "required": ["reviewed_head", "verdict", "findings"],
  "properties": {
    "reviewed_head": {"type": "string"},
    "verdict": {"enum": ["APPROVE", "CHANGES"]},
    "findings": {"type": "array", "items": {"type": "object", "required": ["id", "severity", "location", "claim", "fix"], "properties": {"id": {"type": "string"}, "severity": {"enum": ["blocker", "should", "nit"]}, "location": {"type": "string"}, "claim": {"type": "string"}, "fix": {"type": "string"}}}}
  }
}
```

- A child can't name its own model: record the accepted `devin_mode` and the child session URL in the ledger and report.
- Don't poll. When the child settles, read `structured_output` once with `devin_session_interact` `get` (its last messages if output is missing). Missing output, a failed create, no `verdict`, or a `reviewed_head` other than the briefed head is not approval.
- Never call an API router or a model API directly, and never substitute another model: on a failed create, report the error.
- Don't edit scoped files while a round runs; the child reads the same branch.

Round 1 brief (write it to a file; Sol has no session history):

```
Review only. Do not edit, commit, push, comment on PRs, or start subagents.
Repo: <owner/repo> Branch: <branch> Head: <sha> Base: <sha> Intent: <intent> Out of scope: <scope> Checks: <results>
Check out the branch at Head. See: git diff <base>...<head> [-- <paths>].
Read surrounding code. Find bugs, broken callers, mismatch with intent.
Skip style unless it hides a bug. Hold to the smallest change. Flag code,
tests, or guards the intent does not need. Other paths, rare cases, small
perf, extra compat: nits.
blocker = intended case wrong. should = real bug callers will hit, in intent. nit = rest.
Reply with the structured output: reviewed_head (the SHA you checked out),
verdict APPROVE or CHANGES, and
findings with stable ids (S1, S2, ...), severity, file:line, claim, fix.
```

## 3. Answer findings

Verify each finding and its severity yourself. Another path, rare case, or small cost is a nit whatever its label.

- Agree: smallest fix. Prefer delete or narrow over a new lock, cache, helper, or option. Fix the case that happened. Add one focused test that fails without the fix if intent needs it.
- Disagree: say why, with evidence (file:line, test, output).
- Out of scope or nit: decline in one line; list as follow-up.

Update the ledger. Re-run checks and `git diff --shortstat <base>`; if review grew the diff, cut first. Don't agree just to end the loop.

## 4. Next round

Only if budget remains and a blocker or should is open, behavior code changed, or approval doesn't cover the current behavior diff. Push the fixes, then `devin_session_interact` `message` the same child with `notify_on_response=true` and a new brief: the new pushed head SHA (`git fetch` and check it out), the ledger (`fixed:` / `disagree:` / `declined:` + evidence), `git diff <base>...<new head>`, and `git diff <old head>..<new head>`. Tell Sol: open ids and changed code only, mark each old id `resolved` or `still open: <reason>`. Approval counts only for the head it names; a behavior-changing push after it needs another round.

## 5. Stop and ship

Agreed: `APPROVE` on the current behavior diff, no open blocker or should, no concern of your own. Stuck: an item disputed after two replies, or budget spent. Show both sides in 2-3 lines each and let the user decide via `message_user`. Budget end is not approval.

Loop pushes go to the branch only; update the PR body and ping reviewers only after agreement. Mark ready or open the PR after agreement only if the user asked to push, ship, or update the PR, or a calling workflow such as [`ship-with-proof`](../ship-with-proof/SKILL.md) owns it. When pushing to a PR, add this line to its body with `git_update_pr`, above Devin's session link:

`Reviewed with sol-loop: <N> rounds with a Sol child session (devin_mode <mode>, <session URL>). Sol verdict: <verdict>`, where `<verdict>` is `approved` after `APPROVE`, `nit-only stop (<declined nit ids>)` after an early nit stop, or `caller decision: <decision>` at budget end.

Add `on <effort>` only if verified.

Report with `message_user`, verdict first: rounds, accepted `devin_mode` and child session link, what Sol changed, diff size before/after, fixed and declined findings with reasons, and any failed create calls.
