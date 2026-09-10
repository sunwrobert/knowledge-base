---
name: code-diagram-html
description: Build a self-contained HTML diagram explaining a code change, its control flow, and its impact. Use for visual PR explainers, architecture walkthroughs, or requests to diagram code; optionally render a PNG for sharing.
---

# Code Diagram HTML

Build one self-contained HTML page that gives a reviewer a working mental model of a code change without opening the source. Preserve the project's visual identity when one exists; otherwise use the neutral defaults below. This skill has no organization-specific branding, paths, services, or browser infrastructure requirements.

Save to the repository's documentation or artifact location, defaulting to `docs/<short-slug>.html`. Outside a repository, use a writable artifact directory and return its absolute path. Creating a local artifact does not by itself require committing it. When used by `$create-pr`, follow that skill's reviewer-accessible delivery workflow.

## Ground the explanation

Read the actual diff and relevant code before drawing. Resolve the PR base rather than assuming a branch name. For a stack, compare against the immediate parent. Trace the entry points and decisions needed to explain the change; verify every function name, file reference, threshold, and default. Keep unknown behavior explicit and distinguish active behavior from unused scaffolding.

Open with a short lede: what changed and why it matters. Show the flow rather than a file inventory. Put source references beside the claims they support, using verified repository-relative paths and line numbers. When remote source links are available, prefer links pinned to the reviewed commit.

## Choose the main diagram

| Shape          | Use when                                  | Layout                                               |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| Sequence       | Work moves through actors over time       | Swim lanes, with steps as rows and actors as columns |
| Flow           | Branches later reconverge                 | Top-down graph with labeled forks and merges         |
| Decision tree  | Branches terminate independently          | Cards or a tree with explicit outcomes               |
| Before / after | A refactor or migration is the main story | Matching rows in adjacent panels                     |

Use one main diagram per page. Supporting cards or code panels can explain decisions and transformations without introducing a second competing story. Include impacted files, validation, or observability only when they help explain the actual change; do not invent instrumentation to fill a section.

For flows, label each branch and show where it rejoins or terminates. Keep nodes short, move detail into adjacent notes, and highlight the path affected by the change. Prefer two-way forks where they aid reading, but preserve the real decision structure. Stop at the boundary relevant to the explanation; include response or downstream behavior when that is part of the change.

## Self-contained visual design

Use semantic HTML with all CSS in a `<style>` element. No frameworks, build step, external stylesheets, font CDNs, or runtime network dependencies. Use JavaScript only when interaction materially helps; the core explanation should remain readable without it. Escape code snippets as text.

Match the project's established colors and typography when available. Do not copy a logo or brand treatment from an unrelated project. System fonts are a portable default; embed a local font only when its redistribution license permits it. Inline any images or SVG needed by the page.

When there is no project style, use a restrained neutral theme:

- Background `#f8fafc`, white cards, text `#0f172a`, muted text `#475569`, borders `#cbd5e1`.
- One blue accent (`#2563eb`) for the changed path. Use labeled success/error states; color alone must not carry meaning.
- System sans-serif body and headings; system monospace for code and source labels. Body text around 16px, clear heading hierarchy, comfortable line height.
- Consistent spacing, modest rounded cards, and high contrast. Avoid decorative logos, oversized headers, or dense chrome.

Make the layout work on desktop and narrow screens. Stack comparison panels on mobile, keep reading order intact, and allow local scrolling for wide code or swim lanes instead of clipping the page. Use inline SVG when connectors would otherwise become brittle CSS positioning. Include a print stylesheet when the artifact is intended for export.

## Verify and deliver

Open the page with an available browser or preview tool. Inspect desktop and narrow layouts for clipped text, disconnected branches, overlapping labels, and unreadable contrast. Recheck claims against the final source. If browser verification is unavailable, say so rather than claiming the page was visually checked.

For a PNG, use the available screenshot tool to capture the full document, preferably at 2x scale. Do not assume a fixed CDP endpoint, browser port, agent host, or repository-local rendering script. Inspect the resulting image, fix layout problems, and render again if needed.

Return or open the HTML artifact. When sharing through GitHub or chat, keep a concise native-format explanation alongside it: those surfaces generally cannot render the HTML inline. Attach or link the PNG and downloadable HTML through supported artifact tools. Publish to Slack or another external channel only when the user authorized that destination, and use that channel's native formatting.

Use `$show-me` for the compact inline companion. The HTML carries the detailed diagram; the inline view should still communicate the essential change by itself.
