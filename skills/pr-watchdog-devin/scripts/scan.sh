#!/usr/bin/env bash
# Prints one TSV row per blocker on the open PRs authored by $1 in org $2:
# repo  number  url  head_sha  base  blocker  detail
# blocker is conflict, failing-check, no-approval, or unscanned (mergeability still unknown; report, never dispatch).
# Drafts and PRs in the merge queue get one `skipped` row. Any failed GitHub request aborts the scan with a nonzero exit.
set -euo pipefail
login="${1:?github login}"
org="${2:?github org}"
# CheckRun reports name/conclusion, legacy StatusContext reports context/state; both map to {name, outcome}.
contexts='contexts(first:100){pageInfo{hasNextPage} nodes{... on CheckRun{name conclusion REQ} ... on StatusContext{context state REQ}}}'
query="query(\$q:String!,\$endCursor:String){search(query:\$q,type:ISSUE,first:25,after:\$endCursor){pageInfo{hasNextPage endCursor} nodes{... on PullRequest{number url isDraft isInMergeQueue headRefOid baseRefName mergeable reviewDecision repository{nameWithOwner} commits(last:1){nodes{commit{statusCheckRollup{${contexts//REQ/}}}}}}}}}"
paged='contexts(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{... on CheckRun{name conclusion REQ} ... on StatusContext{context state REQ}}}'
failing_names='[.[]? | {name: (.name // .context), outcome: (.conclusion // .state), required: .isRequired} | select(.outcome as $o | ["FAILURE","TIMED_OUT","STARTUP_FAILURE","ERROR"] | index($o))'
# Unit separator keeps empty columns; tab is IFS whitespace and read would collapse them.
gh api graphql --paginate -f q="is:pr is:open archived:false org:$org author:$login" -f query="$query" \
  --jq ".data.search.nodes[]
    | [(if .isDraft then \"draft\" elif .isInMergeQueue then \"merge-queue\" else \"\" end), .repository.nameWithOwner, (.number|tostring), .url, .headRefOid, .baseRefName, .mergeable, (.reviewDecision // \"NONE\"),
       (.commits.nodes[0].commit.statusCheckRollup.contexts.nodes | $failing_names | .name] | join(\",\")),
       (.commits.nodes[0].commit.statusCheckRollup.contexts.pageInfo.hasNextPage // false | tostring)] | join(\"\u001f\")" |
while IFS=$'\x1f' read -r skip repo num url sha base mergeable review failing truncated; do
  row() { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$repo" "$num" "$url" "$sha" "$base" "$1" "$2"; }
  if [[ -n "$skip" ]]; then row skipped "$skip"; continue; fi
  if [[ "$mergeable" == UNKNOWN ]]; then
    sleep 2
    state=$(gh api "repos/$repo/pulls/$num" --jq '[.head.sha, .mergeable_state] | join(" ")')
    [[ "${state% *}" == "$sha" ]] && state="${state#* }" || state=unknown
    case "$state" in
      dirty) mergeable=CONFLICTING ;;
      unknown) row unscanned "mergeability still unknown" ;;
    esac
  fi
  [[ "$mergeable" == CONFLICTING ]] && row conflict "conflicts with $base"
  if [[ -n "$failing" || "$truncated" == true ]]; then
    # Page through every check on the scanned head, by oid so a push between requests cannot mix revisions.
    required=$(gh api graphql --paginate -f query="query(\$endCursor:String){repository(owner:\"${repo%/*}\",name:\"${repo#*/}\"){object(oid:\"$sha\"){... on Commit{statusCheckRollup{${paged//REQ/isRequired(pullRequestNumber:$num)}}}}}}" \
      --jq ".data.repository.object.statusCheckRollup.contexts.nodes | $failing_names | select(.required) | .name] | .[]" | sort -u | paste -sd, -)
    [[ -n "$required" ]] && row failing-check "$required"
  fi
  [[ "$review" == REVIEW_REQUIRED || "$review" == CHANGES_REQUESTED ]] && row no-approval "$review"
  true
done
