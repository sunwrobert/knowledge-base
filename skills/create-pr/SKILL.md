---
name: create-pr
description: Create or update a GitHub PR with a diff-grounded visual explanation and embedded PNGs when rendering and hosting are available.
---

# Create PR

Load `$show-me` and `$code-diagram-html`. Read the repository PR guidance, template, actual diff, and relevant source. Reuse the existing PR; for a stack, explain each layer against its immediate base using `$gh-stack`.

Lead with the concrete problem and resulting behavior. Make the body understandable inline with a compact Mermaid diagram, before/after diff, pseudocode, or component sketch. Use verified identifiers, preserve required template fields and issue links, and report validation accurately.

Create a self-contained HTML explainer using `$code-diagram-html`. When rendering and a supported private/reviewer-accessible artifact host are available, render it to PNG and **post Markdown image embeds in the PR body** under `## Visualization`, plus a downloadable HTML link when available. Prefer APIs and CLI tools. Do not expose private artifacts publicly, invent URLs, or use local paths/data URLs in GitHub bodies. Do not add artifact commits merely to work around missing hosting for a body-only request.

If PNG rendering or hosting is unavailable, publish the complete inline visual body and briefly report the limitation; PNG delivery must not block the body update. Browser/computer use and visual verification of hosted images are optional, never required. Do not launch a browser solely to verify raster rendering unless asked.

Write the body to a temporary UTF-8 file and publish with `gh pr create --body-file`, `gh pr edit --body-file`, or a structured API request. Creating/updating a PR requires user authorization; draft-only requests stay local. Read back the published body through the API, verify its content and any artifact links, and return the PR URLs with any delivery limitations. Do not claim browser verification or PNG delivery unless performed.
