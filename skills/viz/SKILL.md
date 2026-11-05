---
name: viz
description: The color and chrome rules for every chart, diagram, and data illustration — slide assets, marketing images, HTML explainers, product charts. Covers which palette a series draws from, how axes and gridlines are painted, the sanctioned fill opacities, and how to emphasize a point without recoloring it, plus a capture harness and a static validator. Use before drawing anything with a series, an axis, a node, or a connector, and when reviewing a visual for palette or chrome correctness.
metadata:
  argument-hint: '[what you are drawing, e.g. "cost vs latency scatter" or "request lifecycle diagram"]'
---

# Viz — Color and Chrome Rules for Charts, Diagrams, Illustrations

**Tokens come from the project first.** If the repository has a design spec or token stylesheet (a `DESIGN.md`, a theme CSS file, a chart-colors hook), read its data-viz prose and use its token names; it wins over this file. Otherwise use the neutral defaults in [references/theme.css](references/theme.css). Either way the rules below hold: they are about which token a mark may use, not which hex it is.

## The four failures this prevents

1. **Axes and frames in near-black.** Chart chrome is neutral, never `#000`, never an invented gray.
2. **The accent used as a data fill.** The accent (`--primary`, `--accent`) signals interaction. A data series is never accent-colored, not even the one series the slide is about.
3. **Emphasis by recoloring.** Highlighting a point by switching it to the accent breaks both rules at once. Emphasis is opacity, a ring, and a label.
4. **Invented fill alphas.** A number that "looked about right" instead of a sanctioned value.

## Choosing a series color

Ask what the series _is_, in this order. Stop at the first match.

1. **Is it a named metric the project already colors?** (cost, requests, tokens, credits, and so on.) Then it uses that metric's **semantic role token**. A metric keeps its color on every surface, so it is the same color in a deck as in the product.
2. **Does it encode good, bad, or caution?** Uptime health, a budget over threshold, an error rate. Then, and only then, a **status color** (`--positive`, `--negative`, `--warning`). Status colors are never generic series colors.
3. **Is it an identifiable entity?** A model, provider, customer, service. Then a **categorical slot** (`--chart-1`…`--chart-N`), assigned by stable hash so the entity keeps its color across filters, queries, and surfaces. A curated pinned map is fine if every hue comes from the categorical set and the map is stable app-wide.
4. **Is it an ordered sequence?** (severity tiers, size bands.) An ordered ramp (`--chart-ramp-*` in the defaults). Ramps may be theme-specific so their value labels keep AA contrast.
5. **A category with fixed meaning?** (content type, modality.) Fixed slot assignments, never hash-picked, and never carried by color alone: always an icon and a visible label or tooltip.
6. **Anything else, genuinely anonymous series.** Sequential cycling through the categorical slots.
7. **The aggregate "other" or "rest of" bucket, or a flat no-change sparkline?** The neutral series color (`--chart-other`).

**Never** the accent, in either theme, for any of these. **Never** a hex that is not in the token set.

## Chrome, the non-series parts

- **Axis ticks, tick labels, axis titles** — the muted foreground token.
- **Axis lines, tick marks, gridlines, reference lines** — the border token.
- **Gridlines are dashed and quiet.** A three-on-three dash is the reference.
- **Chart micro-type** — twelve pixels for ticks, legend rows, and tooltip labels. Do not go below twelve.

Hand-authored SVG must put paint tokens in stylesheet declarations, not on presentation attributes (`fill="var(--x)"`): renderers resolve custom properties in attributes inconsistently. Charting libraries that set SVG attributes (Recharts and similar) need resolved color strings from a hook or theme object, not `var()`.

Token syntax follows the source stylesheet. In the defaults, chart tokens, status tokens and their `-text`/`-bg` variants, and `--text-faint` are complete colors used bare; `--background`, `--foreground`, `--muted-foreground`, `--border`, `--primary`, `--accent`, and `--accent-foreground` are HSL channel triples wrapped as `hsl(var(--token))`. Fonts are `var(--font-sans)` for prose and `var(--font-mono)` for micro-type and code labels.

## Source line

Charts and marketing assets carry exactly one `data-viz-source` element whose text begins with `Source: ` followed by non-empty text, bottom-left of the frame in twelve-pixel micro-type on `hsl(var(--muted-foreground))`. Diagrams are exempt because they carry no data, but if a diagram has one it follows the same shape. A chart or marketing asset with genuinely no external source declares `data-viz-source-exception` and a non-empty `data-viz-source-exception-reason` on the root `<html>` element instead.

## Fill opacity, the only sanctioned values

- **Area chart** — a **gradient** from the series color to transparent. Top stop twelve percent for a dense product chart, thirty-five percent for a single-series hero. Bottom stop zero. A fade, not a flat wash.
- **Stacked or banded areas** — the exception, because a fade makes overlapping bands unreadable. Flat fill at forty percent with a full-opacity stroke on the band's top edge.
- **Identity surfaces** (chips, avatars, entity-tinted cards) — background twelve, border twenty, hover wash four. Chip text stays on the neutral foreground; mid-tone chart hues fail AA as text.

No other alphas. The allowlist is discrete, not a range; nearby values in existing code are drift, not new levels. Use the nearest sanctioned step or declare an explicit exception when a missing level is required. Slash alpha in a color value (`hsl(... / 0.12)`) is the same quantity as opacity and uses the same allowlist. An exception carried by a class applies only when every element with that class declares it.

## Emphasis without recoloring

- **Dim the context, do not brighten the subject.** Points outside the focus set drop to roughly a quarter opacity while keeping their own identity color. Focus points stay at full. Hovering a point takes it to full and pushes the rest down further.
- **Rings, not repaints.** A pinned point is a filled dot at its identity color, ringed in the same color at partial opacity, with a background-colored stroke separating it from what is behind.
- **Labels are neutral by default.** Entity labels use the foreground token at micro-type size, medium weight. A value label in a multi-point progression may take its point's ramp or role color because it carries that point's value.
- **Connectors and frontier lines are neutral.** A Pareto frontier is a muted-foreground polyline, two wide, finely dotted. A connector is chrome, not data.

## Diagrams and illustrations

- **Connectors, wires, and arrows are neutral** on the muted-foreground token. The faint text token is for de-emphasized text, not structure. A colored connector makes a claim; mean it.
- **A degraded or failing path may use a status color**, because it encodes bad. Nothing else in a diagram may.
- **The accent is allowed on a diagram**, unlike a chart, but only as identity or emphasis on one surface, never as one of several comparable elements. Three peer boxes with one accented reads as "selected".
- **Standalone marketing assets may declare `data-viz-kind="marketing"`** and use the accent for at most one subject, marked with `data-viz-subject` and targeted by that attribute or the marked element's class or id. Keep non-focus points neutral and frontier connectors neutral.
- Every asset declares exactly one `data-viz-kind`: `chart`, `diagram`, or `marketing`. The marker makes the semantic checks explicit and cannot be omitted to bypass them.

Every diagram must be intelligible without color. Labels, arrowheads, and baselines, always.

## Social square, the format for a post

A slide scaled down to a phone is unreadable, so a post asset is authored as a `1080 × 1080` artboard. One artboard applies to a whole source directory, so square assets live apart from the `1280 × 720` examples. [examples/social-examples/social-square.html](examples/social-examples/social-square.html) is the worked example.

- **Frame** — `96px 64px 56px` padding; the top value clears the band framed capture reserves for a logo.
- **Eyebrow** — one mono line at twenty-one pixels on the muted foreground naming the metric and date range.
- **Headline** — a sans claim at fifty-eight pixels, tight tracking, at most two lines. It states the finding, not the subject.
- **Chart type** — twenty-four-pixel mono ticks, three y ticks, five x ticks. The twelve-pixel floor is a floor; a phone needs about double.
- **Direct labels over legends and axes.** The numbers the post is about ride the marks as forty-six-pixel bold value labels. A legend is a wrapped chip row at twenty-two pixels, five entries at most, with variants of one entity summed into a family so the labels stay short.
- **Footer** — source line bottom-left, the canonical link bottom-right on the foreground token.
- **Fill the artboard.** Size the plot by hand until the axis labels sit just above the footer. A short headline frees vertical space that has to be given back to the plot. An SVG whose `viewBox` height differs from its CSS height silently shrinks the chart.
- **Annotate a comparison point with chrome**: a dashed rule at that week or value with its label in empty plot space, not a dot plus text beside a steep curve.
- **Weight the chrome up.** Gridlines on the muted foreground at one and a half pixels, annotation rules three pixels with a long dash. Still neutral.

## Self-check before you ship

1. Every series color traced back to a rule above, by name.
2. No accent anywhere in a data position.
3. Every axis line, tick, and gridline on a neutral token, with no raw hex or off-token gray in the file.
4. Every fill alpha is a sanctioned value.
5. Emphasis carried by opacity, ring, and label, never by hue substitution.
6. Renders correctly in both themes; categorical hues are theme-constant while everything around them flips.
7. A chart or marketing asset has exactly one valid source line or a declared root exception.
8. Meaning survives in grayscale.

## Bundled files

`<skill>` is this skill's directory.

- [references/theme.css](references/theme.css) — neutral default tokens (Tableau 10 categorical, slate neutral series, an ordered ramp, status colors, light and dark chrome). Take token names from it, never hex values.
- `examples/examples/` — `1280 × 720` worked examples (`chart`, `diagram`, `stacked-bar`, `bubble-scatter`, `dot-plot`); `examples/social-examples/` — the `1080 × 1080` post; `examples/validator-fixtures/` — accepted and rejected specimens. Each source directory's `manifest.json` lists its HTML files; keep it in sync.
- `scripts/` — capture harness, validator, and tests.

## Authoring harness

```bash
bun install --cwd <skill>/scripts
bunx --cwd <skill>/scripts playwright install chromium   # only if no Chromium is cached
bun <skill>/scripts/viz-assets.ts
```

It injects the light and dark token sets from `VIZ_TOKEN_SOURCE` (default `references/theme.css`; point it at the project's stylesheet, which must have `:root` and `.dark` or `:is(.dark)` blocks with the same token names) into a fixed artboard, captures both themes at 2x, and fails if the two captures are identical. Fonts default to system stacks; set `VIZ_FONT_SANS` and `VIZ_FONT_MONO` to `.ttf`/`.woff2` files to embed the project's faces as `var(--font-sans)`/`var(--font-mono)`. Output is transparent (the deck path) unless `VIZ_CAPTURE_MODE=framed`, which paints the background, reserves a top band, and shifts content below it; set `VIZ_LOGO_LIGHT` / `VIZ_LOGO_DARK` to SVG files to place a logo in that band aligned to the content inset. Do not add that furniture to the asset source. Other knobs: `VIZ_ARTBOARD_WIDTH`, `VIZ_ARTBOARD_HEIGHT`, `VIZ_SOURCE_DIR` (default `examples/examples`), `VIZ_OUTPUT_DIR` (default `./viz-output`, mode appended), `PLAYWRIGHT_EXECUTABLE_PATH` for an existing Chrome. A mode-local `manifest.json` records hashes, fonts, and insets.

```bash
VIZ_SOURCE_DIR=<skill>/examples/social-examples VIZ_ARTBOARD_WIDTH=1080 \
  VIZ_ARTBOARD_HEIGHT=1080 VIZ_CAPTURE_MODE=framed bun <skill>/scripts/viz-assets.ts
```

Before accepting an asset:

```bash
bun <skill>/scripts/validate-viz-asset.ts <asset>.html
```

The validator flags raw hex and named colors in color-bearing declarations and presentation attributes, token references on presentation attributes, literal colors hidden in local custom properties, fonts other than `var(--font-sans)`/`var(--font-mono)`, area-fill opacity outside `0`, `12%`, `35%`, `40%`, `100%`, other opacity outside its allowlist, accent tokens in chart color positions, marketing accents on unmarked or multiple subjects, axis/grid/connector selectors whose paint is not a neutral token, wrapped-vs-bare token misuse, and a missing or malformed source line. A literal-color specimen must declare `data-viz-exception` and a non-empty `data-viz-exception-reason` on the element; stylesheet rules targeting it by class or id inherit the exception. It scans rather than parses: rules inside at-rules such as `@media` may go unchecked, and it cannot see computed styles, generated SVG, raster colors, or semantic misuse of a valid token. Rendering both themes and human review remain required. If the project's token names differ, adjust `ACCENT_TOKENS`, `HSL_TOKENS`, and the opacity sets at the top of `validate-viz-asset.ts`.

Run `bun test --cwd <skill>/scripts` when changing the validator, the token source, or the fixtures.
