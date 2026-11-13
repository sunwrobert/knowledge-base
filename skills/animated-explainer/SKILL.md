---
name: animated-explainer
description: Build an animated technical explainer as one standalone HTML file whose JavaScript draws every frame and generates every sound, in the voice of a professional motion graphics designer who explains concepts clearly and efficiently. Use when asked for an animated explainer, motion graphics video, technical walkthrough, "how X works" animation, code-rendered animation, or a motion explainer of a PR, API, system, protocol, pipeline, or dataset. Ships a build script and a headless check script.
---

# Animated explainer

You are a professional motion graphics designer who makes videos that explain concepts clearly and efficiently. Every frame earns its place: one idea per scene, stated in the headline, shown by the motion, and settled long enough to read. Engaging comes from precise motion, not decoration.

The output is a program, not a video: one HTML file whose JavaScript draws each frame from time `t`, so anyone can edit the story, numbers, or timing and rebuild. There is no house style and no shared engine: design the piece, write the engine, and choose the look fresh for each subject.

## Files

- `scripts/build.py <page.html> <out.html>`: inlines local scripts next to the page into one file, replaces `__FONT__` with the bundled Inter (`assets/font.woff2`, Latin subset, OFL) as base64, and fails on any unresolved or external asset reference.
- `scripts/check.py <out.html> [shots_dir]`: headless Chrome sweep, screenshots, contact sheet, and static scan. Exits non-zero on failure.

## Workflow

1. Ground the story.
2. Pick the smallest view per scene.
3. Write the scene list.
4. Design the motion.
5. Write the engine and scenes.
6. Build, check, and look at every screenshot.
7. Deliver.

### 1. Ground the story

- Read the real system: source code, diffs, API schema, docs, test transcripts. When a style reference is given, look at it directly; extract frames from a video with `ffmpeg -i ref.mp4 -vf fps=1 f%02d.png` and a sheet with `montage`.
- Write the one sentence the viewer should understand afterwards, and name the audience. Every later choice serves that sentence; cut anything that does not.
- Follow one concrete, realistic example end to end (one request, one endpoint, one build). A single traced example beats a general overview.
- Capture real values where possible and keep the raw captures next to the source. Never put credentials in the page.
- Tag each claim as observed, documented, or illustrative. Anything illustrative is labeled as such on the page.

### 2. Pick the smallest view per scene

Use the show-me method: skip the preamble, keep prose brief, and give each scene the smallest view that makes its one point clear. Show only the calls, files, fields, states, and boundaries that point needs. Animate the same shapes show-me would draw statically:

| Point to make              | View                                                                                                         | How it moves                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Logic or an algorithm      | pseudocode                                                                                                   | lines type on; the executing line highlights beside its effect            |
| Runtime control flow       | call tree                                                                                                    | nodes build top-down as calls happen; the active path glows               |
| Structure or ownership     | file or component tree                                                                                       | branches grow; the owning module fills with its color                     |
| Interaction or data flow   | sequence or flow diagram                                                                                     | a hero object travels between lanes; crossing a boundary changes it       |
| What a change does         | diff                                                                                                         | the old shape strikes out, the new one slides in, the rest holds still    |
| Gates and policy           | a row of checks                                                                                              | the object passes each gate; a failing gate stops it with the status code |
| Quantities                 | bars, grids, counters                                                                                        | counts derive from the data and tick up to the real number                |
| Lifecycle or state machine | states on a track, taken from the [`statechart`](../statechart/SKILL.md) skill's `chart.mmd` when one exists | a marker moves state to state; transitions draw as arrows                 |

Mixing views is fine when each scene uses the clearest one. Characters, illustration, and music are tools, not requirements. Pick the view a newcomer would follow with the sound off.

Then choose the look: a restrained palette with one accent per idea, strong type hierarchy, and a background that stays out of the way. Follow the brand rules of the repository you are working in for color, chart chrome, emphasis, and fill opacity.

### 3. Write the scene list

Write a table before code: title, headline, duration, caption, view, what moves, cues.

- Aim for 45 to 90 seconds in 8 to 14 scenes of 5 to 9 seconds. Shorter is better when the idea allows it.
- The headline is the scene's claim in a few words ("Four gates before any rule runs", not "Authorization"). A small kicker above it names the chapter.
- Captions are one or two plain sentences. They double as the text walkthrough, so each stands alone without the animation.
- Open on the problem in one striking image (a big number, a wall, a before state). Close on the whole result in one frame.
- Keep continuity: a recurring hero object, fixed colors per concept, and stable positions let the viewer track one thing through the story.

### 4. Design the motion

- Something moves within the first 0.3 s of every scene; the scene is fully settled and readable by about 85% of its duration, then holds.
- Headline first, then the view builds in reading order: left to right, top to bottom, cause before effect.
- Stagger lists by 0.08 to 0.25 s per item. Ease out for arrivals, ease in-out for travel, a small overshoot for things that land and matter; linear only for constant processes.
- Draw connectors with stroke-dash reveals so the eye follows the path; move the hero along that path rather than cutting it to the destination.
- Emphasize one thing at a time: dim the rest to about 30% while the focus pulses or scales slightly.
- Use kinetic typography for the key numbers and claims (count-ups, word reveals); never animate body text for its own sake.
- Transitions are fast (0.3 to 0.5 s) and meaningful: carry the hero across, or wipe in the direction the story moves.
- Show failure as clearly as success: a red stop, the status code, and what is kept (for example a retained draft).

### 5. Write the engine and scenes

Write the engine for this explainer: only the drawing primitives, easings, transitions, and sounds its scenes need. SVG or canvas both work; SVG gives crisp text and path reveals. Keep scene data and draw functions separate from the player so edits stay local.

Rules that make scrubbing, chapter jumps, reduced motion, and screenshots work:

- Each scene's draw is a pure function of scene-local time. No state carried between frames and no `Math.random()` at draw time; use a hash of a stable seed.
- Drive motion from time windows with easing (`k(t, start, end, ease)` returning 0 to 1), and draw in a fixed 1280×720 logical frame scaled to the element and device pixel ratio.
- Keep text at 14px logical or larger; the frame scales down on phones.
- Put measured values in one data object at the top and reference them, so visuals and labels cannot disagree. Derive visual counts from the data.

Sound is procedural Web Audio and part of the design, not an afterthought:

- A quiet music bed on a tempo grid (for example 110 to 120 bpm, a four-chord loop) whose energy follows the story: sparse on the problem, fuller through the build, resolving on the result.
- Short effects on the frame where the matching motion lands (within about 0.1 s): pops for arrivals, ticks for list items and passed checks, a thud for a rejection, a whoosh for travel, a chime for the payoff.
- Schedule both from the timeline, not wall-clock timers, so scrubbing and seeking stay in sync. Run everything through a compressor and keep effects under the music's peak.
- Audio starts from the user's Play gesture; the page opens paused. Provide a sound toggle and `m` to mute.

Player and accessibility requirements:

- Play/pause, replay, previous and next scene, a scrubber, speed, chapter chips, fullscreen, and keyboard controls (Space, arrows, m), all focusable with visible focus.
- The frame has `role="img"` and an `aria-label` updated to the current caption; a live caption region; a full text walkthrough of every caption below the player.
- `prefers-reduced-motion` opens on each scene's settled frame and jumps by scene instead of animating.
- The page works at 375 to 390px wide without horizontal overflow.
- Everything is inline: scripts, styles, and fonts. No network requests at runtime.
- Keep exactly one `requestAnimationFrame` loop alive: store its handle and cancel it before starting another.

Harness hooks that `check.py` relies on:

- An element `<div id="err" role="alert" hidden>` that becomes visible with the message on any uncaught error.
- `#t=<seconds>` opens at that time; `#solo` shows only the frame at the top-left at 1280×720.
- `#sweep` renders every frame at 0.05 s steps, initializes audio and plays every effect and music step, then sets `document.documentElement.dataset.sweep` to JSON `{frames, total, audio, scenes:[{title, start, dur}]}`, where `audio` starts with `running` when audio worked.

### 6. Build and check

```bash
python3 <skill>/scripts/build.py page.html explainer.html
python3 <skill>/scripts/check.py explainer.html shots
```

`check.py` must print PASS. It verifies the sweep, the hidden error region, running audio, and that the file contains no network APIs, external assets, or key-like strings. It writes one screenshot per scene at 85% of its duration, one transition frame, `sheet.png`, and `mobile.png`, and fails if any is missing.

Then review like a designer: open every screenshot and ask whether the headline's claim is visible without the caption. Fix overlapping or clipped text, labels off the frame, a scene still unfinished at 85%, empty or crowded frames, more than one focal point, and mobile text too small to read. Screenshot a few mid-scene frames too, to catch objects that fly in from the wrong place. Re-run until clean. Run `node --check` on edited scripts for faster syntax errors.

The checks cannot hear audio or judge pacing. Say so when delivering, and ask the user to watch it once with sound as a newcomer.

### 7. Deliver

- Attach the built HTML and `sheet.png` to the message. Do not host it on a public site.
- In two or three sentences: what it covers, where the numbers came from, and which parts are illustrative.
- Keep the source page, scripts, and captures so the next edit is a rebuild, not a rewrite.
