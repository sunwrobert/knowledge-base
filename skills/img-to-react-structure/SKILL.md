---
name: img-to-react-structure
description: Converts a UI image/screenshot to React component structure. Translates image to ASCII layout representation, then suggests composable React components. Use when planning component architecture from designs or mockups.
---

# Image to React Structure

Analyze UI images and suggest React component composition.

## Workflow

1. **Read the image** using the Read tool
2. **Create ASCII layout** - draw a simplified text representation showing the structural boxes/regions
3. **Map to React components** - suggest component hierarchy based on both image and ASCII structure

## Step 1: View image

```
Read the image file to see the UI design.
```

## Step 2: ASCII layout

Create a text-based structural representation. Use box-drawing characters:

```
┌─────────────────────────────────┐
│           Header/Nav            │
├─────────┬───────────────────────┤
│         │                       │
│ Sidebar │      Main Content     │
│         │                       │
│         ├───────────┬───────────┤
│         │   Card    │   Card    │
│         └───────────┴───────────┘
└─────────┴───────────────────────┘
```

Label each region with its purpose (nav, sidebar, card grid, footer, etc).

## Step 3: React component mapping

Based on the ASCII structure, suggest components:

```tsx
// Example output format
<Layout>
  <Header>
    <Logo />
    <Nav />
  </Header>
  <Main>
    <Sidebar />
    <Content>
      <CardGrid>
        <Card />
        <Card />
      </CardGrid>
    </Content>
  </Main>
  <Footer />
</Layout>
```

## Output format

Provide:

1. The ASCII layout diagram
2. Component tree (JSX structure)
3. Brief description of each component's responsibility
4. Suggested Tailwind classes for layout (flex, grid, etc.)
