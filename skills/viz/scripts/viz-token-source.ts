import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const DEFAULT_TOKEN_SOURCE_PATH = "references/theme.css";

const REQUIRED_TOKEN_NAMES = [
  "chart-1",
  "chart-other",
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
] as const;

const DARK_SELECTORS = [":is(.dark)", ".dark"] as const;

export type VizTheme = "light" | "dark";

export type VizTokens = Record<string, string>;

export type VizTokenSet = Record<VizTheme, VizTokens>;

/** Reads every `--chart-*` token plus the required chrome and status tokens from a theme stylesheet. */
export async function readVizTokens(
  tokenSourcePath: string
): Promise<VizTokenSet> {
  const source = await readFile(resolve(tokenSourcePath), "utf8");
  const light = parseDeclarations(extractBlock(source, [":root"]));
  const dark = {
    ...light,
    ...parseDeclarations(extractBlock(source, DARK_SELECTORS)),
  };
  const chartNames = Object.keys(light).filter((name) =>
    name.startsWith("chart-")
  );
  const names = [...new Set([...chartNames, ...REQUIRED_TOKEN_NAMES])];

  return {
    light: pickTokens(light, names),
    dark: pickTokens(dark, names),
  };
}

export function toTokenStyle(tokens: VizTokenSet): string {
  return [
    ":root {",
    ...Object.entries(tokens.light).map(
      ([name, value]) => `  --${name}: ${value};`
    ),
    "}",
    ".dark {",
    ...Object.entries(tokens.dark).map(
      ([name, value]) => `  --${name}: ${value};`
    ),
    "}",
  ].join("\n");
}

function extractBlock(source: string, selectors: readonly string[]): string {
  const start = selectors
    .map((selector) => source.indexOf(`${selector} {`))
    .find((index) => index !== -1);
  if (start === undefined) {
    throw new Error(
      `Token source is missing a ${selectors.join(" or ")} block`
    );
  }

  const bodyStart = source.indexOf("{", start) + 1;
  let depth = 1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    }
    if (source[index] === "}") {
      depth -= 1;
    }
    if (depth === 0) {
      return source.slice(bodyStart, index);
    }
  }
  throw new Error(`Token source has an unterminated ${selectors[0]} block`);
}

function parseDeclarations(block: string): VizTokens {
  const withoutComments = block.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries(
    [...withoutComments.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)]
      .map(([, name, value]) =>
        name && value ? [name.slice(2), value.trim()] : null
      )
      .filter((entry): entry is [string, string] => entry !== null)
  );
}

function pickTokens(source: VizTokens, names: readonly string[]): VizTokens {
  return Object.fromEntries(
    names.map((name) => {
      const value = source[name];
      if (!value) {
        throw new Error(`Token source is missing --${name}`);
      }
      return [name, value];
    })
  );
}
