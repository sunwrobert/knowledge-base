---
name: responsive-screenshots
description: Captures website screenshots at Tailwind CSS breakpoints for PRD/design documentation. Use when capturing responsive layouts, creating design specs, or documenting UI at different viewport sizes.
---

# Responsive Screenshots

Capture screenshots at Tailwind CSS breakpoints using agent-browser.

## Breakpoints

| Order | Name | Width  | Filename        |
| ----- | ---- | ------ | --------------- |
| 01    | xs   | 375px  | 01-xs-375.png   |
| 02    | sm   | 640px  | 02-sm-640.png   |
| 03    | md   | 768px  | 03-md-768.png   |
| 04    | lg   | 1024px | 04-lg-1024.png  |
| 05    | xl   | 1280px | 05-xl-1280.png  |
| 06    | 2xl  | 1536px | 06-2xl-1536.png |

## Workflow

1. Ask user for URL and output directory (default: `docs/plans/<feature>/images/`)
2. Create output directory
3. Capture screenshots at each breakpoint
4. Read back each screenshot and visually compare
5. Categorize which breakpoints share the same layout

## Capture commands

```bash
agent-browser open <url>
agent-browser wait 2000  # wait for page to load

agent-browser set viewport 375 812 && agent-browser wait 1000 && agent-browser screenshot <dir>/01-xs-375.png --full
agent-browser set viewport 640 800 && agent-browser wait 1000 && agent-browser screenshot <dir>/02-sm-640.png --full
agent-browser set viewport 768 1024 && agent-browser wait 1000 && agent-browser screenshot <dir>/03-md-768.png --full
agent-browser set viewport 1024 768 && agent-browser wait 1000 && agent-browser screenshot <dir>/04-lg-1024.png --full
agent-browser set viewport 1280 800 && agent-browser wait 1000 && agent-browser screenshot <dir>/05-xl-1280.png --full
agent-browser set viewport 1536 864 && agent-browser wait 1000 && agent-browser screenshot <dir>/06-2xl-1536.png --full

agent-browser close
```

## Layout comparison

After capturing, use the Read tool to view each screenshot. Visually compare layouts and group breakpoints that share the same design:

- **Mobile**: Typically xs, sm (single column, hamburger menu)
- **Tablet**: Typically md (may show sidebar, 2-column)
- **Desktop**: Typically lg, xl, 2xl (full navigation, multi-column)

Report which breakpoints share layouts, e.g.:

- "Mobile (xs, sm): same single-column layout"
- "Tablet (md): unique 2-column layout"
- "Desktop (lg, xl, 2xl): same full-width layout"
