---
name: sol-loop-devin
description: >-
  Devin's Sol review loop. In Devin, use this instead of the upstream tstack `sol-loop` skill, which depends on T3 Code's `delegate_task`. Reviews a code change with OpenAI's GPT Sol in a loop before (or after) filing a PR: one read-only Sol reviewer run as a native Devin child session (`devin_mode` `gpt-6-1-sol`) on Devin's native model selection, not an API router, a fixed round budget, a severity ledger, and the smallest fix per agreed finding. Use when the user says "sol loop", "sol-loop", "/sol-loop", "sol-loop-devin", or "review this with Sol".
metadata:
  version: 2.0.0
  adapted-from: https://github.com/t3dotgg/tstack/blob/1085050f3baed1ac724caa4a8166145fb2ac88af/skills/sol-loop/SKILL.md
---

# sol-loop-devin

A workflow for making your code changes more correct before (or sometimes after) filing a pull request: GPT Sol reviews the change in a loop.

Make the smallest possible changes to satisfy the Sol reviewer. Watch for scope creep and push back when a finding is wrong.

## Budget

- Default: 3 rounds total. Round 1 is full. Later rounds check only changed code and open findings.
- Extend to 5 only for security, permissions, auth, data loss, or state/concurrency, while a blocker or should stays open with evidence. Or when the user asks.
- Stop early if a round returns only nits. Declined nits and comment, doc, or format-only fixes need no new round.
- One reviewer only. Sol runs as one read-only child session for every round; do not start a second one, another child session, or the testing agent to review.
- Keep a ledger: id, severity, outcome, round. Never guess it.

## 1. Scope

Run `git status --short`. Do not stash, discard, or include unrelated changes. Limit review to the change paths if they separate cleanly. Otherwise stop and ask with `message_user`.

Find the base after `git fetch origin`:

- PR: read `baseRefName` and the head SHA with `git_view_pr` (or `GH_REPO=<owner>/<repo> gh pr view <url> --json baseRefName,headRefOid`; the git remote is a proxy, so spell the repo out). Check out the branch only if clean. Confirm `HEAD` is the PR head, or ahead only by this change; if ahead, commit the scoped change and push it to the PR branch, then confirm the remote head equals `HEAD` before round 1. Base: `git merge-base HEAD origin/<baseRefName>`.
- Local: `git merge-base HEAD origin/<default-branch>`. The child session only reads what is on the remote, so commit the scoped change (untracked files included) to its branch, push it, and confirm the remote head equals `HEAD`. If the change must stay unpublished, or there is no remote, the child cannot read it: stop and tell the user, and push only with their explicit permission.

The change is base to the pushed head in those paths. Use one diff command all rounds. State intent and out-of-scope in 1-2 sentences. Run covering checks. Do not send code this change breaks. Note missing or pre-failing checks in the brief.

## 2. Start Sol

Sol runs as a child Devin session on Sol's model, started the same way [`council-devin`](../council-devin/SKILL.md) starts its Sol member. Use Devin's native model selection; never call an API router or any model API directly for this loop.

Start it from a `scripted_tools` script with one `devin_session_create` call:

- `devin_mode`: `gpt-6-1-sol`. The tool schema and the 422 for an unknown mode list only the picker modes, but the server accepts this ID from `scripted_tools`; near spellings such as `gpt-6.1-sol` or `sol-6-1` are rejected. Use another Sol ID only when the user names one.
- `repos`: the repo, `title`: `Sol review round 1: <change>`, `notify_on_response=true`, the round 1 brief as `prompt`.
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

- Model evidence: a child session cannot name its own model, so record the `devin_mode` the create call accepted and the child session URL in the ledger and report.
- Do not poll. When the child settles, read `structured_output` once with `devin_session_interact` `get`, and its last messages if the output is missing. A missing output, a failed create, no `verdict`, or a `reviewed_head` that differs from the head the brief named is not approval. If the create call fails, report the error; do not fall back to an API router or another model.

Do not edit scoped files while a round runs: the child reads the same branch.

Round 1 brief (write it to a file, Sol has no session history):

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

Sol reviews the pushed head named in the brief. Unpushed work is invisible to the child.

## 3. Answer findings

Check each finding and severity yourself. Another path, rare case, or small cost is a nit, whatever label it came with.

- Agree: smallest fix. Prefer delete or narrow over new lock, cache, helper, or option. Fix the case that happened. Add one focused test that fails without the fix, if intent needs it.
- Disagree: say why, with evidence (file:line, test, output).
- Out of scope or nit: decline in one line. List as follow-up.

Update the ledger. Re-run checks and `git diff --shortstat <base>`. If review grew the diff, cut first. Do not agree just to end the loop.

## 4. Next round

Start one only if budget remains and a blocker or should is open, behavior code changed, or approval does not cover the current behavior diff. Push the fixes, then message the same child session with `devin_session_interact` `message` and `notify_on_response=true` (same session, same model), with a new brief: the new pushed head SHA with `git fetch` and a checkout of it, the ledger (`fixed:` / `disagree:` / `declined:` + evidence), the base diff command against the new head (`git diff <base>...<new head>`), and the change since last round (`git diff <old head>..<new head>`). An approval counts only for the head it names; a behavior-changing push after it needs another round. Tell Sol: open ids and changed code only. Mark each old id `resolved` or `still open: <reason>`.

## 5. Stop and ship

Agreed: APPROVE on the current behavior diff, no blocker or should open, no concern of your own. Stuck: an item stays disputed after two replies, or budget ends. Show both sides in 2-3 lines each and ask the user with `message_user`; the user decides. Budget end is not approval.

Pushes during the loop go to the branch only, so the child can read them; do not update the PR body or ping reviewers until agreement. Mark the PR ready or open it after agreement only if the user asked to push, ship, or update the PR, or a calling workflow such as [`ship-with-proof`](../ship-with-proof/SKILL.md) owns the PR. If you push to a PR, add this line to the PR body with `git_update_pr`, above the session link Devin appends:

`Reviewed with sol-loop: <N> rounds with a Sol child session (devin_mode <mode>, <session URL>). Sol verdict: <verdict>`, where `<verdict>` is `approved` after verdict `APPROVE`, `nit-only stop (<declined nit ids>)` after an early stop on nits, or `caller decision: <decision>` at budget end.

Add `on <effort>` only if verified.

Report with `message_user`, verdict first: rounds, the accepted `devin_mode` and child session link, what Sol changed, diff size before/after, fixed and declined findings with reasons, and any failed create calls.
