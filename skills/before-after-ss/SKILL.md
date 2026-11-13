---
name: before-after-ss
description: >-
  Produce the `## Before / after` section for a UI change: matched base-vs-branch screenshots of each changed surface at the same viewport and state in light and dark mode, the changed element boxed or circled, a what-to-look-for caption per surface, and a PR-ready table. Use for "/before-after-ss", "before and after screenshots", "show what changed visually", or a playbook's UI evidence step (e.g. ship-with-proof).
metadata:
  version: 1.4.0
---

# Before / after: highlighted UI evidence

Rendered pixels from the real app or Storybook, never a diagram. One row per changed surface and theme, base on the left, branch on the right, the same highlight on both, plus a caption.

## Inputs

- The diff or PR and its base ref (default `origin/main`).
- How the surface renders locally. Use Storybook or the local dev stack, started the way the repository documents. Never edit seed files or app source just to enable a screenshot.
- A Chrome exposing CDP (`--cdp` or `CDP_ENDPOINT`; signed-in routes need it), or `playwright install chromium`. With no endpoint the script launches headless Chromium.

## Procedure

1. List every route, story, dialog, drawer, table, or control whose rendered output changes, with the UI state each needs (signed in, tab, filter, open menu, loading, empty, error). A pure refactor with no visual or DOM change is skipped, and the section says so.
2. Run base in its own worktree (`git worktree add ../base origin/main`) on its own port, sharing the branch's backend, seed, and account so only the code differs. If both can't run at once, capture base first, then branch, with no data change between.
3. Match state: viewport (`1280x900` desktop, `390x844` mobile), route or story id, scroll, open state, data, theme. Set the theme the way the app does (next-themes `theme` in localStorage plus `prefers-color-scheme`, or the Storybook `theme` global), never a CSS override. Wait for skeletons, spinners, and fetches to settle unless loading is the subject.
4. Select the element by accessible role and name (`role=button[name="Save"]`), then `data-testid`, then structural CSS. If the tag differs between sides (`div[role=button]` became `button`) or the element is missing on one, pass `--before-selector` and `--after-selector`; never loosen to a container.
5. Capture with `scripts/annotate.py` in this skill's directory:

   ```bash
   python3 scripts/annotate.py \
     --before-url http://localhost:3001/settings/keys \
     --after-url http://localhost:3000/settings/keys \
     --selector 'role=button[name="Create key"]' \
     --viewport 1280x900 --shape box \
     --out-dir /tmp/before-after --slug keys-create-button
   ```

   Per theme in `--themes` (default `light,dark`) it saves `<slug>-<theme>-before.png` and `<slug>-<theme>-after.png` at device scale 2 with the highlight drawn, and prints geometry JSON. Use `--themes light|dark` only to recapture one theme after a fix.
   - Theme: it sets the theme itself and exits if `<html>` lacks the `dark` class exactly when dark. For a surface themed by media query or data attribute, pass `--no-theme-check` and confirm by opening the PNGs. For one that ignores next-themes (hardcoded palette, iframe, story without the theme decorator), fix how the theme is applied or mark that theme `not measured (<reason>)`.
   - Auth: it attaches to the session Chrome over CDP and copies its cookies and same-hostname local storage, so keep a signed-in app tab open while it runs. `--launch` starts a fresh headless Chromium with no session.
   - Scroll: one shared `--scroll-y` for both sides. If it exits because the target is outside the viewport or the scroll was clamped, pick a `--scroll-y` both pages reach, or `--full-page`.
   - `--shape circle` for icon-sized targets.
   - Unreachable state (open dialog, expanded row, wizard step): `--setup FILE.py` defining `setup(page)` runs the same actions on both sides before locating; add `--ready-selector` for a hydration marker before `setup` clicks.
   - Async content: the default `--wait-until load` fires before app fetches finish, so pass `--wait-selector` on a settled-state marker or the sides can show different intermediate states. A drifting highlight means the page moved between locate and capture: add `--wait-selector` or a longer settle wait.

   Keep the full viewport for context; don't crop.

6. Open every PNG in both themes. The highlight must sit on the changed element on both sides, with matching state and theme, and no error overlay, stuck spinner, or layout break. A shot showing a bug is a finding: fix the code, push, recapture. Sides that differ beyond the change mean different data or a stale server: restart the base server and hard-refresh. A Storybook first load showing only a spinner means warm the story once.
7. Caption each row in one plain line naming the element and the visible difference to confirm, including any difference that appears in only one theme.
8. Upload the PNGs through the PR tool or as `message_user` attachments, then write the section below into the PR body, separate from `## Show me` and `## Visualization`.

## Output

```markdown
## Before / after

Real browser screenshots, <viewport>, same seeded data and UI state, light and dark mode. Left is `origin/main` (`<sha>`), right is this branch (`<sha>`). The red box marks the migrated element.

| Surface | Before (origin/main) | After (this branch) |
| --- | --- | --- |
| Keys page, Create key button (`ApiKeysHeader`), light | ![before](URL) | ![after](URL) |
| Keys page, Create key button (`ApiKeysHeader`), dark | ![before](URL) | ![after](URL) |
| Look for: same label and placement, native focus ring on Tab, DS `Button` hover shade in both themes. | | |
| Mobile nav drawer (390x844), light and dark | not measured (drawer only mounts with a signed-in session, blocked locally) | |
```

- Per surface: a light row, a dark row, then its caption row. No collapsible elements.
- Every step-1 surface appears in both themes, as a pair or `not measured (<reason>)`.
- Don't commit the PNGs.
