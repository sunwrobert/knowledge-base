---
name: create-pr
description: Create or update a GitHub pull request whose body combines show-me visuals with embedded PNGs rendered from a self-contained code-diagram-html explainer grounded in the actual diff.
---

# Create PR

Make the PR body a visual explanation of the change using both `$show-me` and `$code-diagram-html`. Load those skills before composing the description. Install both alongside this skill; if either is unavailable, identify the missing dependency rather than claiming its workflow ran.

## Compose from the actual change

Read the repository's PR guidance and template, resolve the correct base branch, and inspect the full PR diff and relevant source. For a stacked PR, explain only its layer relative to its immediate base. Reuse an existing PR for the branch instead of creating a duplicate.

Lead with one or two sentences describing the concrete problem and resulting behavior. Make the core of the body `$show-me` output: choose a Mermaid flow or sequence, a before/after diff, pseudocode, a call tree, or a component sketch that makes the change clear. Use verified identifiers and paths, and put short explanations next to the visuals. Avoid a generic inventory of changed files.

Also apply `$code-diagram-html` to create one self-contained HTML explainer of the same change. Give it a stable, reviewer-accessible location: follow the repository's artifact convention or include the generated HTML in the PR under an appropriate documentation path. Include only this deliberately generated artifact, not unrelated local files. Use a verified link to the artifact in the body, clearly labeled as HTML to download and open. If repository policy precludes committing it and no supported artifact host is available, report that delivery limitation and keep the inline visual complete.

GitHub PR bodies do not render arbitrary HTML, CSS, local filesystem links, or embedded data-URL images. The body must remain understandable without opening the HTML. Use GitHub-rendered Mermaid or fenced sketches inline. Render the HTML explainer to PNG and embed the resulting images in the PR body; this is required, not an optional attachment. Never invent an upload URL or imply that a repository HTML blob link is a live preview.

Include concise validation results and any material limitations. Preserve required template fields and issue links. State exactly what ran, what passed or failed, and what remains unverified; do not claim screenshots or checks that were not performed.

## Render and embed the PNGs

Use `$code-diagram-html` to render the complete explainer, preferably at 2x scale. Inspect the PNG for clipped text, disconnected branches, and unreadable labels. Fix and re-render any problems. Split a tall render into readable sections when necessary, preserving the full explanation and its order.

Upload the PNGs through a supported artifact mechanism, or use repository-hosted images when repository policy permits committing generated artifacts. Use image URLs that GitHub can render and reviewers can access. Never expose private artifacts through a public host just to obtain an image URL. Local paths and data URLs are not valid delivery substitutes; `gh pr create` and `gh pr edit` do not upload files referenced in Markdown.

Add a `## Visualization` section to the PR body containing Markdown image embeds (`![Descriptive alt text](verified-image-url)`) for every rendered section, followed by the downloadable HTML link. A PNG link alone, an image in a comment, the HTML attachment, or a Mermaid block does not satisfy the embedded-PNG requirement.

If rendering or image hosting is unavailable, preserve the completed draft and report the specific blocker. Do not silently downgrade to an HTML-only or Mermaid-only body, or claim this workflow is complete without the PNGs.

## Publish and verify

Follow the user's authorization and the repository's commit, push, and verification rules. A request to create a PR authorizes creating it; a request only to draft a body does not authorize publication. Use `$gh-stack` when the branch is in a stack, then edit that layer's generated PR body.

Write the complete body to a temporary UTF-8 file and use `gh pr create --body-file <file>` or `gh pr edit <number> --body-file <file>`, with explicit repository and base/head scope as appropriate. Do not interpolate the body into shell code.

Read back the published body and check artifact links. Open the PR in a browser and confirm the PNGs actually render in the body and remain legible at GitHub’s displayed width. A successful body update or image URL fetch alone does not prove rendering. If browser verification is unavailable, report the rendering check as unverified. Verify that diagram labels still match the final diff, including any generated artifact commit. Return the PR URL and report any remaining delivery or validation limitations.
