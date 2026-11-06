import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_TOKEN_SOURCE_PATH, readVizTokens } from "./viz-token-source";

describe("readVizTokens", () => {
  test("loads the chart, neutral, and status token sets from the default theme.css", async () => {
    const skillRoot = fileURLToPath(new URL("../", import.meta.url));
    const tokens = await readVizTokens(
      `${skillRoot}${DEFAULT_TOKEN_SOURCE_PATH}`
    );

    const expectedKeys = [
      ...Array.from({ length: 10 }, (_, index) => `chart-${index + 1}`),
      "chart-other",
      "chart-ramp-1",
      "chart-ramp-2",
      "chart-ramp-3",
      "chart-ramp-4",
      "background",
      "foreground",
      "muted-foreground",
      "border",
      "primary",
      "accent",
      "accent-foreground",
      "text-faint",
      "positive",
      "positive-text",
      "positive-bg",
      "negative",
      "negative-text",
      "negative-bg",
      "warning",
      "warning-text",
      "warning-bg",
    ];
    const concreteColor =
      /^(?:#[\da-f]{6,8}|-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?%\s+-?\d+(?:\.\d+)?%(?:\s*\/\s*\d+(?:\.\d+)?)?)$/i;

    for (const theme of ["light", "dark"] as const) {
      expect(Object.keys(tokens[theme])).toEqual(expectedKeys);
      for (const key of expectedKeys) {
        expect(tokens[theme][key]).toMatch(concreteColor);
      }
    }

    expect(
      [
        "background",
        "foreground",
        "muted-foreground",
        "border",
        "primary",
        "accent",
        "accent-foreground",
      ].every((key) => tokens.light[key] !== tokens.dark[key])
    ).toBe(true);
  });
});
