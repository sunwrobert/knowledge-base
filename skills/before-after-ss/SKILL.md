---
name: before-after-ss
description: Produce the `## Before / after` evidence section for a UI change. Captures matched screenshots of the same surface on the base branch and the PR branch at the same viewport and state, in both light and dark mode, highlights the changed element in both with a box or circle derived from its browser bounding box, writes a one-line what-to-look-for caption per row, and emits the PR-ready table. Use when the user says "/before-after-ss", "before and after screenshots", "show what changed visually", or when a playbook such as ship-with-proof reaches its UI evidence step.
metadata:
  version: 1.1.0
---

# Before / after: highlighted UI evidence

Rendered pixels from the real app or Storybook, never a diagram. One row per changed user-facing surface and theme, base branch on the left, PR branch on the right, the changed element highlighted in both, and a caption telling the reviewer what to look at. Every surface is captured in both light and dark mode, because a design-system swap that looks right in one theme often breaks contrast or borders in the other.

## Inputs

- The diff or PR under review and its base ref (default `origin/main`).
- How the surface renders locally: Storybook or the local dev stack, started the way the repository documents. Do not edit seed files or application source only to make a screenshot possible.
- A Chrome exposing CDP (`--cdp` or `CDP_ENDPOINT`; signed-in routes need it), or `playwright install chromium`. With no endpoint the script launches headless Chromium.

## Procedure

1. List the surfaces. Walk the diff and write down every route, story, dialog, drawer, table, or control whose rendered output changes. Skip pure refactors with no visual or DOM change, and say so in the section. Record the UI state each surface needs (signed in, which tab, which filter, open menu, loading, empty, error).
2. Stand up both sides. Check out the base ref in a separate worktree (`git worktree add ../base origin/main`) and run it on its own port, sharing the same backend, seed, and account as the PR branch so the only variable is the code. If both sides cannot run at once, capture the base first, then the branch, without changing data in between.
3. Match the state. Same viewport (`1280x900` desktop, `390x844` mobile), same route or story id, same scroll position, same open state, same data, same theme. Capture every surface in light and in dark mode. Set the theme the way the app does (next-themes `theme` in localStorage plus `prefers-color-scheme`, or the Storybook `theme` global), never with a CSS override. Wait for the surface to settle (no skeletons, spinners, or pending fetches) unless the loading state is the subject.
4. Locate the element. Prefer an accessible role and name (`role=button[name="Save"]`), then a stable `data-testid`, then a structural CSS selector. When the before and after tags differ (a `div[role=button]` became a `button`), pass `--before-selector` and `--after-selector` separately so both shots highlight the same control.
5. Capture and highlight with `scripts/annotate.py` in this skill's directory:
   ```bash
   python3 scripts/annotate.py \
     --before-url http://localhost:3001/settings/profile \
     --after-url http://localhost:3000/settings/profile \
     --selector 'role=button[name="Save"]' \
     --viewport 1280x900 --shape box \
     --out-dir /tmp/before-after --slug profile-save-button
   ```
   It captures one pair per theme in `--themes` (default `light,dark`), reads the element's bounding box through Playwright, saves `<slug>-<theme>-before.png` and `<slug>-<theme>-after.png` at device scale 2, draws the highlight, and prints the geometry per theme as JSON. For each theme it emulates `prefers-color-scheme`, writes the next-themes `theme` localStorage key before load, merges `theme:<theme>` into the `globals` query of Storybook `iframe.html` URLs, and exits if `<html>` does not carry the `dark` class exactly when the theme is dark. For a surface themed by media query or a data attribute instead of the class, pass `--no-theme-check` and confirm the theme by opening the PNGs. Pass `--themes light` or `--themes dark` only to recapture one theme after a fix. By default it attaches to the session Chrome over CDP and copies that browser's cookies and local storage into each capture. Local storage is seeded only into origins on the same hostname as the capture URL, so a login on `localhost:3000` also applies on `localhost:3001` without handing other sites' storage to either page. Playwright reads local storage from open tabs only, so keep a tab of the signed-in app open while the script runs (`--launch` uses a fresh headless Chromium with no session). It picks the first visible match for the selector, skipping hidden responsive duplicates. It applies the same `--scroll-y` to both pages, checks the page actually reached it, and refuses to scroll one side on its own. If it exits saying the target is outside the viewport or the scroll was clamped, pass one shared `--scroll-y` both pages can reach or `--full-page`. Use `--shape circle` for a small icon-sized target and `--wait-selector` for a marker that proves the page is settled. For a state a bare URL cannot reach (an open dialog, an expanded row, a wizard step), pass `--setup FILE.py` defining `setup(page)`. It runs the same clicks and typing on both sides before the target is located, so the pair stays matched and the row stays measured rather than `not measured`. Pass `--ready-selector` for a marker that proves the page is hydrated before `setup` clicks anything. The default `--wait-until load` avoids `networkidle`, which never settles on some dev servers, but `load` fires before application fetches finish, so a surface that populates asynchronously needs `--wait-selector` on a settled-state marker or the pair can show different intermediate states. Both images keep the full viewport so the reviewer sees context. Do not crop.
6. Verify each pair by opening both PNGs, in both themes. The highlight must sit on the migrated element in both, the two shots must show the same state and theme, and neither may contain an error overlay, a stuck spinner, or a layout break. A shot that shows a bug is a finding. Fix the code, push, and recapture.
7. Write the caption. One line per row, plain words, naming the element and the visible difference a reviewer should confirm. Say what to compare, not what the code does. Call out any difference that shows up in only one theme.
8. Emit the section and upload the images. Send the PNGs through the PR tool or as `message_user` attachments so they get uploaded URLs, then write the section below into the PR body. Keep it separate from `## Show me` and `## Visualization`, which explain code, not pixels.

## Output

```markdown
## Before / after

Real browser screenshots, <viewport>, same seeded data and UI state, light and dark mode. Left is `origin/main` (`<sha>`), right is this branch (`<sha>`). The red box marks the migrated element.

| Surface | Before (origin/main) | After (this branch) |
| --- | --- | --- |
| Profile page, Save button (`ProfileHeader`), light | ![before](URL) | ![after](URL) |
| Profile page, Save button (`ProfileHeader`), dark | ![before](URL) | ![after](URL) |
| Look for: same label and placement, native focus ring on Tab, DS `Button` hover shade in both themes. | | |
| Mobile nav drawer (390x844), light and dark | not measured (drawer only mounts with a signed-in session, blocked locally) | |
```

Rules for the section:

- Each surface gets a light row and a dark row, then one caption row directly under them. No collapsible elements.
- Every surface listed in step 1 appears in both themes, as a screenshot pair or as `not measured (<reason>)`. Never drop a surface or a theme silently.
- Highlight semantics are identical on both sides: same shape, same color, same element.
- The images are the rendered app or story. Diagrams, DOM dumps, and code diffs belong in other sections.
- Do not commit the PNGs to the repository.

## Failure modes

- Element not found on one side: the selector matched the new markup only. Supply the per-side selector rather than loosening it to a container.
- Highlight drifts from the control: the page scrolled or animated between locate and screenshot. Add `--wait-selector` or increase the settle wait, then recapture.
- Base and branch differ beyond the change: the two servers point at different data or one is stale. Restart the base worktree server and hard-refresh before recapturing.
- Storybook first load shows only the loading spinner: warm the story once, then capture.
- Script exits saying the page ignored the theme: the surface does not read next-themes (a hardcoded palette, an iframe, or a story without the theme decorator). Fix how the theme is applied, or list that theme as `not measured (<reason>)`.
