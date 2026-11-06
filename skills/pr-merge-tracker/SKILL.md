---
name: pr-merge-tracker
description: Report open pull requests in the current or requested GitHub repository, ranked by merge confidence (0-100), combining CI and review metadata with an initial diff review.
---

Report the selected author's open pull requests, ranked by merge confidence (0-100). This skill reports readiness; it does not merge pull requests.

## Resolve scope

Use the repository and author requested by the user. Otherwise resolve the repository from the current checkout and default the author to the authenticated GitHub user:

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
author=$(gh api user --jq .login)
```

Stop if either lookup fails. If no repository can be resolved, ask for its `owner/repo`. Do not substitute a fixed repository or username. Reuse the resolved scope for every command; when the user supplies it, assign those values instead of running the defaults above.

## Collect readiness

```bash
gh pr list --author "$author" --state open --limit 100 -R "$repo" --json number,url,title,baseRefName,headRefName,headRefOid,isDraft,reviewDecision,mergeable,mergeStateStatus,changedFiles,additions,deletions
```

If the list reaches 100 results, paginate before claiming complete coverage. If merge states are `UNKNOWN`, retry after about 30 seconds with a bounded retry count; report unresolved states as unknown.

Inspect each PR's current reviews and checks:

```bash
gh pr view <number> -R "$repo" --json latestReviews,reviewDecision,statusCheckRollup,mergeable,mergeStateStatus
gh pr checks <number> -R "$repo" --required
```

Use GitHub's `reviewDecision` and the repository's applicable review requirements. A blank decision does not prove approval is needed or satisfied. Consult current reviews and branch protection or rulesets when needed and accessible. An individual approval, including a bot approval, does not by itself prove all required reviews are satisfied. Report unavailable requirements as unknown.

Group PRs into:

- Merge Now: non-draft, conflict-free PRs whose required checks and reviews are satisfied and whose GitHub merge state permits merging.
- Almost There: PRs waiting on checks or a lower PR in a stack. Resolve stack dependencies from head/base refs and show them in dependency order; recheck followers after their base changes.
- Needs Review: required approvals are missing or changes were requested.
- Blocked / Drafts / Unknown: failing checks, conflicts, drafts, other unmet requirements, or unavailable readiness data. State the specific reason.

## Review and score

Start with a metadata baseline: tiny metadata-only diffs 95-98; small tested fixes 85-94; bigger, novel, or infrastructure changes 75-84. Missing required approval caps the score around 70, conflicts around 45-72, and drafts around 40-60. These are subjective confidence scores, not probabilities or substitutes for merge requirements.

Collect diffs with the bundled collector, not `gh pr diff`, the pulls/files API, or the compare API's `files`. Those cap at 300 files or 20,000 lines and silently turn large reviews into samples:

```bash
python3 <skill-dir>/scripts/collect_diffs.py collect -R "$repo" --out "$run/diffs" <numbers...>
```

It resolves each PR's merge base and head through the API, fetches them into a blob-filtered bare cache (`~/.agents/state/pr-merge-tracker/git/`), and writes `<n>/net.patch`, `<n>/inventory.txt`, `<n>/manifest.json` and `<n>/chunks/NNN.patch` (80,000 characters each, with hunks split, never truncated). If the caller keeps a state file whose `prs.<number>.reviewedHeadSha` records the last reviewed head, pass it with `--state`. Unchanged heads then get no chunks, and `delta` chunks hold only files whose own +/- lines changed, so main-only churn drops out. A nonzero exit or any `errors` or `inventoryMismatch` entry means that PR has no complete diff; report it as such and do not label it reviewed.

Chunk kinds: `required` (code, config, tests, docs, and any file whose diff touches an `export`), `mechanical` (only import/require specifier or blank-line changes), `generated` (lockfiles, snapshots, fixtures, generated or binary files). Rename-only files appear only in the inventory. Read every `required` chunk. Spot-check `mechanical` and `generated` chunks against the inventory, and do not count them as read code. When one reviewer cannot read every required chunk of a PR, split that PR's chunks across reviewers, then merge the verdicts.

Each reviewer returns the chunk IDs it actually read. Compute the review depth; never write it by hand:

```bash
python3 <skill-dir>/scripts/collect_diffs.py depth "$run/diffs/<n>/manifest.json" --read 001 002 ...
```

The label is `full (...)` only when every required chunk was read and the inventory matches GitHub's file count. Otherwise it reads `sampled N%`. A reviewer's `sampled` flag or a listed limitation always wins over a summary method string. Never upgrade one to `full`. For diffs too large to read in full, read every `config` and export-touching file and a sample of the rest, keep the computed `sampled N%` label, and lower the score unless the unread part is shown to be mechanical.

Check for breaking changes, removed exports still referenced, API changes, migrations, authentication and billing risks, performance-sensitive paths, caching, sensitive values in logs, and test coverage for behavior changes. Read the repository's own guidance for project-specific constraints. Lower the score for concrete risks and include the review verdict in the rationale.

Only repeat the diff review for new PRs or changed `headRefOid` values. Reuse unchanged diff verdicts, but refresh CI, reviews, merge state, and the resulting score every run. If the diff is unavailable, label the score metadata-only and explain the limitation. Do not claim tests were run because test files or CI results exist.

## Report

Return a ranked list with one bullet per PR: score, readiness group, one-line rationale, `sampled N%` when the review was not full, and a Markdown link using the PR's returned `url`. Give the full and sampled counts in the summary line. Flag newly merged or closed PRs and new PRs since the previous run. Verify the state of previously tracked PRs before calling them merged or closed; disappearance from the list alone is not sufficient.

Report once per invocation. If a recurring monitor invokes this skill, follow its configured notification policy and cadence.
