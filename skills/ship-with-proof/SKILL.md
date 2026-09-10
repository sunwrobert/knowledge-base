---
name: ship-with-proof
description: Carry a change through implementation, a bounded thermo-nuclear review fix loop, recorded end-to-end proof, visual PR documentation, CI, and review resolution. Use when asked to ship a change with proof or finish an existing PR through its evidence and review gates; does not merge the PR.
---

# Ship With Proof

Take one scoped change from implementation to a reviewable PR with evidence that the new behavior works and an adjacent flow still works. Run the chain in the current session. Creating the PR is an intermediate milestone, not completion. Do not merge it.

## Resolve scope and dependencies

Use the current or requested repository and its agent guidance, PR template, testing conventions, and verification commands. Accept an existing PR and reuse it; search for a matching PR before creating one. Do not assume a repository name, package manager, default branch, reviewer, review bot, messaging channel, or browser host.

Infer the flow to exercise from the task and diff. Ask only when a missing choice affects the work: the intended behavior, a non-obvious proof flow, the required reviewer, or an external destination. Preserve caller-required PR sections, evidence markers, and artifacts.

Use these skills for their respective work:

- `$git-commit` for scoped commits, and `$gh-stack` when the repository requires or already uses a stack.
- `$thermo-nuclear-code-quality-review` for each complete review pass; `$thermo-nuclear-review-fix-loop` for repair discipline, subject to this workflow's four-round limit.
- `$create-pr`, `$show-me`, and `$code-diagram-html` for visual PR documentation, subject to the evidence delivery rules below.
- The repository's end-to-end testing and review-thread resolution skills when available. Otherwise use its documented test commands, available recording tools, and GitHub review APIs.

Load dependencies when their step begins. Identify a missing skill rather than pretending it ran. Continue independent work while resolving the missing dependency. This workflow does not assume a particular agent platform.

## Implement and test

Implement the smallest complete change that satisfies the task. Preserve unrelated work, response contracts, and error precedence unless changing them is part of the request. Run the repository's required checks before committing. Keep each stack layer independently reviewable and explain only that layer's delta in its PR.

Add or extend tests that distinguish the defect from the fix and cover unchanged inputs. Do not weaken assertions or remove coverage to hide a failure. When an intentional behavior change requires updating an existing expectation, explain that change and preserve the relevant regression coverage. For changes with no executable behavior, state why unit coverage is inapplicable rather than inventing a test.

Create or update the PR with a conventional title and the required content. Its body must include a standalone `## Show me` section with one or two compact GitHub-renderable blocks from `$show-me`: a diff, pseudocode, call or component tree, or Mermaid diagram grounded in real names and paths.

## Run the thermo loop

Review the entire scoped diff and relevant surrounding code, fix actionable findings, run verification, commit and push fixes, then review the updated diff again. A pass must not be limited to checking earlier findings.

An actionable finding identifies a structural problem introduced by the change with a repair inside the agreed scope. Record reasoned refutations. Explicitly defer findings that require unrelated work, a new architectural layer, or a product decision; do not silently expand the PR or count a deferred issue as fixed.

Record each round under `## Thermo-nuclear fix loop`, including the reviewed head, findings, fixes or reasoned dispositions, and verification. Keep the final empty result visible when the loop terminates cleanly.

Stop after four review rounds if findings remain. Document the remaining findings and report the gate as incomplete; the cap is a stopping condition, not permission to claim a clean review. This limit takes precedence over the loop skill's default unbounded repetition. Do not create a separate goal unless the user or host instructions authorize one.

## Capture proof early

As soon as the thermo loop is clean, capture end-to-end proof. Do not wait for CI or an asynchronous reviewer. The recording must show both the changed behavior and at least one adjacent pre-existing flow that the diff could plausibly break.

Use the repository's test environment and available recording tools. Annotate test starts and assertions using `test_start` and `assertion` markers when supported, or equivalent visible labels and a timestamped test log. Record the tested commit and exact scenario. Avoid exposing credentials or private user data in recordings and logs.

A recording with a failed assertion, stuck state, error, or broken layout is a finding. Fix the problem, rerun relevant checks, and record again from scratch. Substantive fixes return through the thermo gate.

For API-only, CLI, or backend changes without a meaningful visual surface, use an end-to-end run and captured request/response or structured log evidence instead of an empty browser recording. State what it proves and why video is inapplicable. If the needed runtime, credentials, or capture tool is unavailable, report that gate as blocked; screenshots alone do not establish an interaction sequence.

## Build and deliver the visual explanation

Use `$code-diagram-html` and `$show-me` to produce a self-contained `<change-slug>-<date>.html` explaining the defect and fix, or the new behavior and affected flow. Include the relevant before/after shape, decisive tests, thermo results, and evidence links. For performance changes, show measured before/after values with workload and iteration count. Every measurement must be traceable to captured output from this run; never invent numbers to fill a chart.

Use inline CSS and SVG, no network assets or build step. Follow the project's visual conventions or the HTML skill's neutral defaults. Verify desktop and narrow layouts. Render the page at approximately 2x scale with an available browser tool, inspect the PNG, and split tall images if that is needed for readable text.

Do not commit generated evidence HTML, PNGs, or recordings. Upload through an authorized, supported artifact mechanism that gives reviewers usable URLs. Check access and link validity. If no such mechanism is available, retain local evidence and report the delivery gate as blocked; never manufacture a URL or assume a local Markdown path uploads a file.

Put the HTML URL and uploaded PNGs under a separate `## Visualization` section. GitHub does not render arbitrary HTML or inline SVG in PR bodies. Keep the `## Show me` blocks readable independently of the attachment. For a change too small to benefit from an HTML artifact, state the reason in the PR; the inline visual remains required.

Post the recording or equivalent backend evidence and key screenshots together in one PR comment, describing which flow each item proves. Use actual uploaded URLs. Send the user the PR and evidence links at this milestone, before waiting for reviewer approval. Do not use collapsible sections in the PR body or evidence comments.

## Finish CI and review

Inspect checks and failing job logs with the available GitHub tools. Fix failures attributable to the change and report unrelated infrastructure failures accurately. Address every actionable review thread with a fix or a reasoned response. Resolve a thread only when it has actually been addressed and repository conventions permit it.

Use the reviewer or review process selected by the user or required by the repository. Never hardcode a bot or treat one named reviewer's approval as satisfying all branch rules. If approval is required but no reviewer can be identified, ask while continuing evidence and CI work.

Request review through the normal PR mechanism. Messages to Slack or another external channel require explicit authorization for that destination; this skill does not grant it. Keep one review conversation and avoid duplicate pings. Handle feedback in this session; do not launch a separate babysitter that can push concurrent branch changes.

Fix or refute comments, push scoped commits, rerun affected checks, and request re-review only when needed. Stop pinging after approval. If a reviewer is unavailable, authorization is missing, or an external service remains blocked, preserve the current state and report the exact outstanding gate rather than waiting or retrying indefinitely. Do not configure a recurring monitor unless requested.

## Keep evidence current

A late behavior change invalidates evidence for the path it touches. Re-run that proof, and repeat thermo review for substantive code changes. Refresh CI and review status after every push. Evidence may come from an earlier commit only when its covered behavior still matches the final head; explain that relationship rather than claiming it was recorded on the final commit.

Complete means required CI is green, required approvals are current, review threads are addressed, the thermo loop is clean, and the PR carries valid proof and visual documentation. An exhausted review budget or blocked gate must be reported as incomplete.

Return the PR link, final head, CI and approval states, thermo result, HTML and image links or the justified small-change exception, recording or equivalent evidence URL, and anything not tested with its reason. If another caller owns the final report, hand it those facts. Never merge as part of this skill.
