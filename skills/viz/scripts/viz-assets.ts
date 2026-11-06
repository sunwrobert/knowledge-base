import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import type { CaptureRecord as ThemeCaptureRecord } from "./viz-capture-assertions";
import type { VizTheme } from "./viz-token-source";

import { assertThemeCapturesDiffer } from "./viz-capture-assertions";
import {
  DEFAULT_TOKEN_SOURCE_PATH,
  readVizTokens,
  toTokenStyle,
} from "./viz-token-source";

const ARTBOARD_WIDTH = readPositiveInteger(
  process.env.VIZ_ARTBOARD_WIDTH,
  1280
);
const ARTBOARD_HEIGHT = readPositiveInteger(
  process.env.VIZ_ARTBOARD_HEIGHT,
  720
);
const DEVICE_SCALE_FACTOR = 2;
const FRAME_TOP_BAND_HEIGHT = 72;
const FRAME_CONTENT_TOP = FRAME_TOP_BAND_HEIGHT + 24;
const LOGO_WIDTH = 220;
const SANS_FALLBACK =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO_FALLBACK =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const FONT_SOURCE_PATH = readOptionalPath(process.env.VIZ_FONT_SANS);
const MONO_FONT_SOURCE_PATH = readOptionalPath(process.env.VIZ_FONT_MONO);
const LOGO_PATHS = {
  dark: readOptionalPath(
    process.env.VIZ_LOGO_DARK ?? process.env.VIZ_LOGO_LIGHT
  ),
  light: readOptionalPath(
    process.env.VIZ_LOGO_LIGHT ?? process.env.VIZ_LOGO_DARK
  ),
} as const;
const CAPTURE_MODE = readCaptureMode(process.env.VIZ_CAPTURE_MODE);

type PngStats = {
  width: number;
  height: number;
  sha256: string;
};

type CaptureRecord = PngStats &
  ThemeCaptureRecord & {
    asset: string;
    contentInset: number | null;
    fontFamily: string;
    logoSource: string | null;
    theme: VizTheme;
    path: string;
    themeProbe: string;
  };

const SKILL_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SOURCE_DIR = process.env.VIZ_SOURCE_DIR
  ? resolve(process.env.VIZ_SOURCE_DIR)
  : join(SKILL_ROOT, "examples/examples");
const TOKEN_SOURCE = resolve(
  process.env.VIZ_TOKEN_SOURCE ?? join(SKILL_ROOT, DEFAULT_TOKEN_SOURCE_PATH)
);
const OUTPUT_DIR = resolve(process.env.VIZ_OUTPUT_DIR ?? "viz-output");
const EXECUTABLE_PATH = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

async function captureVizAssets(): Promise<void> {
  const tokens = await readVizTokens(TOKEN_SOURCE);
  const fontStyle = await buildFontStyle();
  const logos = {
    dark: LOGO_PATHS.dark
      ? (await readFile(LOGO_PATHS.dark, "utf8")).trim()
      : null,
    light: LOGO_PATHS.light
      ? (await readFile(LOGO_PATHS.light, "utf8")).trim()
      : null,
  };
  const manifestValue: unknown = JSON.parse(
    await readFile(join(SOURCE_DIR, "manifest.json"), "utf8")
  );
  if (
    !Array.isArray(manifestValue) ||
    !manifestValue.every((value): value is string => typeof value === "string")
  ) {
    throw new Error(
      `${SOURCE_DIR}/manifest.json must contain a JSON array of HTML filenames`
    );
  }
  const sourceFiles = manifestValue;

  const browser = await chromium.launch(
    EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : {}
  );
  const records: CaptureRecord[] = [];

  try {
    for (const sourceFile of sourceFiles) {
      const asset = sourceFile.replace(/\.html$/, "");
      for (const theme of ["light", "dark"] as const) {
        const page = await browser.newPage({
          viewport: { width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT },
          deviceScaleFactor: DEVICE_SCALE_FACTOR,
        });
        try {
          await page.goto(`file://${join(SOURCE_DIR, sourceFile)}`, {
            waitUntil: "load",
          });
          await page.evaluate(
            ({ theme, style, mode }) => {
              document.documentElement.classList.toggle(
                "dark",
                theme === "dark"
              );
              const tokenStyle = document.createElement("style");
              tokenStyle.dataset.vizTokens = "authoritative";
              tokenStyle.textContent = style;
              document.head.append(tokenStyle);
              if (mode === "framed") {
                document.documentElement.style.background =
                  "hsl(var(--background))";
                document.body.style.background = "hsl(var(--background))";
              }
            },
            {
              theme,
              style: toTokenStyle(tokens),
              mode: CAPTURE_MODE,
            }
          );
          await page.addStyleTag({ content: fontStyle });
          const themeProbe = await page.evaluate(() => {
            const probe = document.createElement("div");
            probe.style.backgroundColor = "hsl(var(--background))";
            document.body.append(probe);
            const color = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return color;
          });
          if (!themeProbe) {
            throw new Error(
              `Theme probe did not resolve for ${asset}/${theme}`
            );
          }
          const fontFamily = await page.evaluate(
            async (families) => {
              for (const family of families) {
                await document.fonts.load(`400 16px "${family}"`);
                if (!document.fonts.check(`16px "${family}"`)) {
                  throw new Error(
                    `Injected visualization font ${family} did not load`
                  );
                }
              }
              await document.fonts.ready;
              return getComputedStyle(document.body).fontFamily;
            },
            [
              FONT_SOURCE_PATH ? "Viz Sans" : null,
              MONO_FONT_SOURCE_PATH ? "Viz Mono" : null,
            ].filter((family): family is string => family !== null)
          );
          const contentBounds =
            CAPTURE_MODE === "framed"
              ? await page.evaluate(() => {
                  const bounds: DOMRect[] = [];
                  const addBounds = (rect: DOMRect): void => {
                    if (rect.width > 0 && rect.height > 0) {
                      bounds.push(rect);
                    }
                  };
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT
                  );
                  while (walker.nextNode()) {
                    const node = walker.currentNode;
                    if (
                      node.parentElement?.closest('[aria-hidden="true"]') ||
                      !node.textContent?.trim()
                    ) {
                      continue;
                    }
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    addBounds(range.getBoundingClientRect());
                  }
                  for (const element of document.querySelectorAll<HTMLElement>(
                    "body *"
                  )) {
                    if (
                      element.closest('[aria-hidden="true"]') ||
                      /^(?:SCRIPT|STYLE|META|LINK|HEAD|HTML|BODY)$/i.test(
                        element.tagName
                      )
                    ) {
                      continue;
                    }
                    const style = getComputedStyle(element);
                    const isSvgGraphic =
                      /^(?:PATH|CIRCLE|ELLIPSE|RECT|LINE|POLYLINE|POLYGON|TEXT)$/i.test(
                        element.tagName
                      );
                    const hasBackground =
                      style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                      style.backgroundColor !== "transparent";
                    const hasBorder = [
                      style.borderTopStyle,
                      style.borderRightStyle,
                      style.borderBottomStyle,
                      style.borderLeftStyle,
                    ].some((borderStyle) => borderStyle !== "none");
                    if (isSvgGraphic || hasBackground || hasBorder) {
                      addBounds(element.getBoundingClientRect());
                    }
                  }
                  const content = bounds.reduce(
                    (result, rect) => ({
                      left: Math.min(result.left, rect.left),
                      top: Math.min(result.top, rect.top),
                      bottom: Math.max(result.bottom, rect.bottom),
                    }),
                    {
                      left: Number.POSITIVE_INFINITY,
                      top: Number.POSITIVE_INFINITY,
                      bottom: Number.NEGATIVE_INFINITY,
                    }
                  );
                  const shiftableTop = [...document.body.children]
                    .filter(
                      (element) =>
                        element.getAttribute("aria-hidden") !== "true" &&
                        !/^(?:SCRIPT|STYLE|META|LINK|HEAD|HTML|BODY)$/i.test(
                          element.tagName
                        )
                    )
                    .map((element) => element.getBoundingClientRect().top)
                    .filter((top) => Number.isFinite(top))
                    .reduce(
                      (top, elementTop) => Math.min(top, elementTop),
                      Number.POSITIVE_INFINITY
                    );
                  return { ...content, shiftableTop };
                })
              : null;
          const contentInset =
            contentBounds && Number.isFinite(contentBounds.left)
              ? Math.max(
                  24,
                  Math.min(
                    Math.max(24, ARTBOARD_WIDTH - LOGO_WIDTH),
                    contentBounds.left
                  )
                )
              : 48;
          if (
            CAPTURE_MODE === "framed" &&
            contentBounds &&
            Number.isFinite(contentBounds.top)
          ) {
            const contentShift = FRAME_CONTENT_TOP - contentBounds.top;
            if (
              contentBounds.shiftableTop + contentShift < 0 ||
              (Number.isFinite(contentBounds.bottom) &&
                contentBounds.bottom + contentShift > ARTBOARD_HEIGHT)
            ) {
              throw new Error(
                `${asset}/${theme} does not fit the artboard after framed top-band reservation`
              );
            }
            await page.evaluate((shift) => {
              for (const child of document.body.children) {
                if (
                  child.getAttribute("aria-hidden") === "true" ||
                  /^(?:SCRIPT|STYLE|META|LINK)$/i.test(child.tagName)
                ) {
                  continue;
                }
                if (
                  !(child instanceof HTMLElement) &&
                  !(child instanceof SVGElement)
                ) {
                  continue;
                }
                child.style.transform =
                  `${child.style.transform} translateY(${shift}px)`.trim();
              }
            }, contentShift);
          }
          const logoData = theme === "light" ? logos.light : logos.dark;
          if (CAPTURE_MODE === "framed" && logoData) {
            await page.evaluate(
              async ({ logoData, left, width }) => {
                const furniture = document.createElement("div");
                furniture.setAttribute("aria-hidden", "true");
                furniture.style.cssText = `
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 2147483647;
            `;
                const logo = document.createElement("img");
                logo.alt = "";
                const encodedLogo = btoa(
                  Array.from(new TextEncoder().encode(logoData), (byte) =>
                    String.fromCharCode(byte)
                  ).join("")
                );
                logo.src = `data:image/svg+xml;base64,${encodedLogo}`;
                logo.style.cssText = `position:absolute;left:${left}px;top:24px;width:${width}px;height:auto;`;
                await logo.decode();
                furniture.append(logo);
                document.body.append(furniture);
              },
              {
                logoData,
                left: contentInset,
                width: LOGO_WIDTH,
              }
            );
          }
          const relativePath = join(CAPTURE_MODE, asset, `${theme}.png`);
          const path = join(OUTPUT_DIR, relativePath);
          await mkdir(resolve(path, ".."), { recursive: true });
          const buffer = await page.screenshot({
            path,
            clip: {
              x: 0,
              y: 0,
              width: ARTBOARD_WIDTH,
              height: ARTBOARD_HEIGHT,
            },
            omitBackground: CAPTURE_MODE === "transparent",
          });
          records.push({
            asset,
            contentInset: CAPTURE_MODE === "framed" ? contentInset : null,
            fontFamily,
            logoSource: theme === "light" ? LOGO_PATHS.light : LOGO_PATHS.dark,
            theme,
            path: relativePath,
            themeProbe,
            ...imageStats(buffer),
          });
        } finally {
          await page.close();
        }
      }
    }
  } catch (error: unknown) {
    await browser.close();
    throw error;
  }

  await browser.close();

  for (const asset of new Set(records.map((record) => record.asset))) {
    assertThemeCapturesDiffer(records, asset);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(join(OUTPUT_DIR, CAPTURE_MODE), { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, CAPTURE_MODE, "manifest.json"),
    `${JSON.stringify(
      {
        sourceDir: SOURCE_DIR,
        tokenSource: TOKEN_SOURCE,
        fontSource: FONT_SOURCE_PATH,
        monoFontSource: MONO_FONT_SOURCE_PATH,
        mode: CAPTURE_MODE,
        artboard: { width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT },
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
        assets: records,
      },
      null,
      2
    )}\n`
  );
}

async function buildFontStyle(): Promise<string> {
  const faces = await Promise.all(
    [
      { family: "Viz Sans", path: FONT_SOURCE_PATH },
      { family: "Viz Mono", path: MONO_FONT_SOURCE_PATH },
    ].map(async ({ family, path }) => {
      if (!path) {
        return "";
      }
      const data = (await readFile(path)).toString("base64");
      const format = path.endsWith(".woff2")
        ? "woff2"
        : path.endsWith(".woff")
          ? "woff"
          : "truetype";
      return `@font-face { font-family: '${family}'; font-style: normal; font-weight: 100 900; font-display: block; src: url(data:font/${format};base64,${data}) format('${format}'); }`;
    })
  );
  const sans = FONT_SOURCE_PATH
    ? `'Viz Sans', ${SANS_FALLBACK}`
    : SANS_FALLBACK;
  const mono = MONO_FONT_SOURCE_PATH
    ? `'Viz Mono', ${MONO_FALLBACK}`
    : MONO_FALLBACK;
  return `${faces.join("\n")}\n:root { --font-sans: ${sans}; --font-mono: ${mono}; }`;
}

function readOptionalPath(value: string | undefined): string | null {
  return value === undefined || value.trim() === "" ? null : resolve(value);
}

function imageStats(buffer: Buffer): PngStats {
  return {
    width: ARTBOARD_WIDTH * DEVICE_SCALE_FACTOR,
    height: ARTBOARD_HEIGHT * DEVICE_SCALE_FACTOR,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${value}`);
  }
  return parsed;
}

function readCaptureMode(value: string | undefined): "transparent" | "framed" {
  if (value === undefined || value === "transparent") {
    return "transparent";
  }
  if (value === "framed") {
    return "framed";
  }
  throw new Error(
    `Expected VIZ_CAPTURE_MODE to be transparent or framed, received ${value}`
  );
}

if (import.meta.main) {
  await captureVizAssets();
}
