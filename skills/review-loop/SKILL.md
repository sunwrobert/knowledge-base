---
name: review-loop
description: Request a review from the repository's review bot or required reviewers for one PR or every layer of a stack (bottom-up), then optionally drive the PR(s) to approval in this session by resolving threads, fixing CI, and re-requesting review until the reviewer approves. Never merges. Use when the user says "request a review", "review the stack", "babysit this PR", "drive this PR to approval", or names a review bot to ask.
metadata:
  version: 1.0.0
---

# Review Loop

Two modes:

- **Request** (default): send exactly one review request for a PR or a whole stack, confirm pickup, report. Nobody addresses the findings.
- **Drive** (when the user asks to babysit or drive to approval, or this session owns the PR and the caller expects approval): triage threads, fix CI, request review, address the verdict, repeat until approved. Never merge.

Never run two drivers on one branch. If another live session owns the PR, ask it or the user instead of driving it here.

## Inputs

Take each from the repository's `AGENTS.md`, `CONTRIBUTING.md`, `CODEOWNERS` or review docs first, then from the user. Do not guess; if the reviewer or channel is unknown, ask and stop.

- **PRs.** One or more PR URLs or numbers. If this session created exactly one PR, use it. Strip chat link wrapping (`<url|label>`), labels, and `#issuecomment-...` fragments down to `https://github.com/<owner>/<repo>/pull/<N>`.
- **Reviewer.** The GitHub login(s) whose review counts, for example a review bot's `<name>[bot]` or a team. A bot may post under more than one login; list every one.
- **Request channel**, one of:
  - GitHub review request: `gh pr edit <N> --add-reviewer <login-or-team>`.
  - PR comment mention: `gh pr comment <N> --body '<mention shape>'`.
  - Chat channel the user or repo names (Slack or similar), as a top-level message there. Never a DM unless the reviewer is documented to read DMs.
- **Message shape.** The exact text the reviewer answers to (for example `@bot review <url>`, `@bot review stack <url> <url>`, `@bot re-review please: <url>`). The shape is what usually drifts; copy it from the repo docs or a recent message the reviewer answered.
- **Approval signal.** What counts as approved: a review with state `APPROVED` from the reviewer login (default), a specific check run, or a comment. Also note whether the repository dismisses stale approvals on push.

## Chat-channel requests

- Post as the identity the reviewer answers to. When it answers bot-authored messages, prefer a bot identity, which adds no human to the thread's followers. Never post the request as a reply in this session's own chat thread instead of the named channel.
- A mention needs the raw ID markup the chat tool expects (Slack: `<@U...>` looked up from the reviewer's profile); a display name is plain text. Bot users are often missing from user search.
- Put each URL on its own line, followed by a blank line before any context, so the auto-link does not swallow the next line. Disable link unfurls.
- Keep the message timestamp. Every later ping for that PR is a reply in that thread.
- If no tool can post to the channel, tell the user the request was not sent and what to post. Do not fall back to another channel.

## Request: one PR

1. Resolve the PR and inputs.
2. If a request for this PR was already sent earlier in this session, send the re-review shape in the same thread or comment chain instead of a new request.
3. Send one request through the request channel, containing the mention shape and the PR URL and nothing else.
4. Confirm pickup. Read the chat thread if the tool can read it. Otherwise check for a reviewer review submitted after the request:
   ```bash
   gh api --paginate repos/<owner>/<repo>/pulls/<N>/reviews --jq '.[] | [.submitted_at,.user.login,.state] | @tsv' | grep -E $'\t(<login1>|<login2>)\t' | tail -1
   ```
   Reviews come back oldest first across pages, so the last matching line is the latest state. A `submitted_at` older than the request means no answer yet. With no pickup within 15 minutes, report the status as inconclusive with the request link, not as pending.
5. Report the request link and PR link in one short message. When invoked as a step of another skill, return to it.

## Request: a stack

1. Fetch the anchor: `gh pr view <N> --json number,headRefName,baseRefName,state,isDraft`.
2. Walk down: while the base is not the default branch, find the open PR whose head is that base: `gh pr list --state open --head <base> --json number,headRefName,baseRefName,isDraft`.
3. Walk up: find open PRs whose base is the current head: `gh pr list --state open --base <head> --json number,headRefName,baseRefName,isDraft`, until none. `gh stack view --json` is a shortcut for a [`gh-stack`](../gh-stack/SKILL.md) stack.
   - More than one PR at a step is a fork. Ask which branch to follow; send nothing.
   - Exclude closed and merged PRs; include drafts.
   - Several PRs named together are a stack, not an ambiguity.
   - `--head` matches the exact branch name, so a branch renamed after a restack stops the walk early. Check `gh stack view` or base-branch history before reporting a shorter stack than expected.
4. Order bottom-up from the base branches, never from the order the user typed.
5. One PR: use the single-PR request. Otherwise, if the reviewer has a stack shape, send one request listing every layer bottom-up; if not, send one request per layer, bottom-up, in the same channel.
6. A re-review lists only the layers with new commits since the last request (all of them if that cannot be determined).
7. Confirm a verdict or pickup per layer and report the request link with the PR list in stack order, naming layers with no verdict yet.

Prefer one stack request plus in-session fixes over driving several layers in parallel sessions: parallel drivers restack their layers independently and de-sync the stack. After parallel drivers, verify `git merge-base --is-ancestor <base> <top>` per adjacent pair and restack once they are done.

## Drive to approval

1. **Own the branch.** Check it out (`git fetch origin <branch> && git checkout <branch>`) and subscribe to PR notifications if the host supports it.
2. **Triage unresolved threads** before requesting:
   ```bash
   gh api graphql --paginate -f query='query($endCursor: String){repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<N>){reviewThreads(first:100, after:$endCursor){pageInfo{hasNextPage endCursor} nodes{id isResolved comments(first:1){nodes{databaseId author{login} bodyText}}}}}}}'
   ```
   For each unresolved thread HEAD does not already address: fix it, run scoped tests and lint, push. Document an intentional deferral in the reply (and a test pin or the PR description), never silently. Reply `Fixed in <linked sha>` or the reason not to fix, react thumbs-up (fixed) or thumbs-down (declined), then resolve:
   ```bash
   gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<THREAD_ID>"}) { thread { isResolved } } }'
   ```
   Never resolve a thread you have not verified is addressed.
3. **Fix CI.** Read failing job logs and fix the root cause. If the branch is behind or conflicts with base, update it the way the repository prefers (stacked PR: [`green-stack`](../green-stack/SKILL.md)). After three failed attempts, ask the user.
4. **Request review** only once threads are resolved and CI is green. Immediately before, re-check the reviewer's latest state and do not request if it already meets the approval signal.
5. **Wait for the verdict** through notifications; otherwise poll the reviews command every three to five minutes. No answer 30 minutes after a request: send one bare nudge in the same thread. No answer 30 minutes after that: report to the user and stop.
6. **Handle the verdict.**
   - Approved: address remaining non-blocking notes, reply and resolve those threads, stop. Do not request another review; approval stands through follow-up pushes unless the repository dismisses stale approvals.
   - Findings: address every one (fix or documented rationale), keep CI green, reply and resolve, push, then send the re-review shape in the same thread. Repeat from step 5. At most three re-review requests per session; after the third without approval, report and stop.
7. **Exit** when the approval signal holds, CI is green, and zero threads are unresolved. Post one short status (PR link, CI status, how findings were handled) where the request lives, and stop.
8. **Later activity** (comments, pushes, CI): fix or justify new findings, reply and resolve, keep CI green, post one status line (sha, CI status). Request again only if the repository dismissed the approval.

## Rules

- One request per invocation per PR or stack; no unsolicited follow-ups beyond the single 30-minute nudge. A review the reviewer itself reports as failed may be re-requested once, after confirming the PR carries no review.
- Request mode does not check out the repo, inspect diffs, run CI, restack, or touch threads.
- Never request review while CI is red or threads are unresolved, never after approval, never more than three re-reviews per session. Every re-review follows a pushed change.
- Do not batch-resolve threads without verified fixes, do not modify tests to make them pass, and do not merge, enqueue, or enable auto-merge.
- A standing team review request is not evidence the reviewer is reviewing the current changes. Track the actual request and verdict; keep human sign-off separate.
