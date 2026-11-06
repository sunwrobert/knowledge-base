import { readFile } from "node:fs/promises";

const AREA_FILL_OPACITIES = new Set([0, 0.12, 0.35, 0.4, 1]);
const GENERAL_OPACITIES = new Set([
  0, 0.04, 0.12, 0.18, 0.2, 0.28, 0.3, 0.6, 0.65, 0.7, 0.85, 1,
]);
const COLOR_PROPERTY_PATTERN =
  "(?:color|fill|stroke|border(?:-(?:top|right|bottom|left))?-color|border|stop-color|background(?:-color)?|background-image|box-shadow|text-shadow|outline(?:-color)?|text-decoration-color|caret-color|flood-color|lighting-color)";

const NAMED_COLORS = new RegExp(
  `\\b(?:${[
    "aliceblue",
    "antiquewhite",
    "aqua",
    "aquamarine",
    "azure",
    "beige",
    "bisque",
    "black",
    "blanchedalmond",
    "blue",
    "blueviolet",
    "brown",
    "burlywood",
    "cadetblue",
    "chartreuse",
    "chocolate",
    "coral",
    "cornflowerblue",
    "cornsilk",
    "crimson",
    "cyan",
    "darkblue",
    "darkcyan",
    "darkgoldenrod",
    "darkgray",
    "darkgreen",
    "darkgrey",
    "darkkhaki",
    "darkmagenta",
    "darkolivegreen",
    "darkorange",
    "darkorchid",
    "darkred",
    "darksalmon",
    "darkseagreen",
    "darkslateblue",
    "darkslategray",
    "darkslategrey",
    "darkturquoise",
    "darkviolet",
    "deeppink",
    "deepskyblue",
    "dimgray",
    "dimgrey",
    "dodgerblue",
    "firebrick",
    "floralwhite",
    "forestgreen",
    "fuchsia",
    "gainsboro",
    "ghostwhite",
    "gold",
    "goldenrod",
    "gray",
    "green",
    "greenyellow",
    "grey",
    "honeydew",
    "hotpink",
    "indianred",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "lavenderblush",
    "lawngreen",
    "lemonchiffon",
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgreen",
    "lightgrey",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightslategrey",
    "lightsteelblue",
    "lightyellow",
    "lime",
    "limegreen",
    "linen",
    "magenta",
    "maroon",
    "mediumaquamarine",
    "mediumblue",
    "mediumorchid",
    "mediumpurple",
    "mediumseagreen",
    "mediumslateblue",
    "mediumspringgreen",
    "mediumturquoise",
    "mediumvioletred",
    "midnightblue",
    "mintcream",
    "mistyrose",
    "moccasin",
    "navajowhite",
    "navy",
    "oldlace",
    "olive",
    "olivedrab",
    "orange",
    "orangered",
    "orchid",
    "palegoldenrod",
    "palegreen",
    "paleturquoise",
    "palevioletred",
    "papayawhip",
    "peachpuff",
    "peru",
    "pink",
    "plum",
    "powderblue",
    "purple",
    "rebeccapurple",
    "red",
    "rosybrown",
    "royalblue",
    "saddlebrown",
    "salmon",
    "sandybrown",
    "seagreen",
    "seashell",
    "sienna",
    "silver",
    "skyblue",
    "slateblue",
    "slategray",
    "slategrey",
    "snow",
    "springgreen",
    "steelblue",
    "tan",
    "teal",
    "thistle",
    "tomato",
    "turquoise",
    "violet",
    "wheat",
    "white",
    "whitesmoke",
    "yellow",
    "yellowgreen",
  ].join("|")})\\b`,
  "i"
);
const ACCENT_TOKENS = /var\(--(?:primary|accent|accent-foreground)\)/i;
const CHART_TOKENS = /var\(--chart(?:-[\w-]+)?\)/i;
const HSL_TOKENS =
  /var\(--(?:background|foreground|muted-foreground|border|primary|accent|accent-foreground)\)/i;
const FAINT_TEXT_TOKEN = /var\(--text-faint\)/i;
const BRAND_FONT = /var\(--font-sans\)/i;
const MONO_FONT = /var\(--font-mono\)/i;

type ColorPosition = {
  value: string;
  offset: number;
  exception: boolean;
  isAreaFill: boolean;
  origin: "presentation-attribute" | "inline-style" | "stylesheet";
};

async function validateVizAsset(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    throw new Error("Usage: bun validate-viz-asset.ts <asset.html>");
  }

  const source = await readFile(file, "utf8");
  const failures = findVizAssetFailures(source);

  if (failures.length > 0) {
    throw new Error(
      `Rejected ${file}:\n${failures.map((failure) => `- ${failure}`).join("\n")}`
    );
  }

  console.log("[viz-validator] Accepted asset", {
    asset_path: file,
    coverage:
      "token-bearing declarations, typography, declared literal-color exceptions, opacity roles, and stylesheet axis/grid attributes",
    blind_spots:
      "computed styles, generated SVG, raster images, semantic misuse of a valid token, and diagram-vs-chart intent",
  });
}

export function findVizAssetFailures(source: string): string[] {
  const normalizedSource = stripComments(source);
  return [
    ...validateKind(normalizedSource),
    ...validateSourceLine(normalizedSource),
    ...validateExceptions(normalizedSource),
    ...validateCustomProperties(normalizedSource),
    ...validateColors(normalizedSource),
    ...validateMarketingAccent(normalizedSource),
    ...validateOpacity(normalizedSource),
    ...validateChrome(normalizedSource),
    ...validateTypography(normalizedSource),
  ];
}

function validateKind(source: string): string[] {
  const kinds = [
    ...source.matchAll(/\bdata-viz-kind\s*=\s*["']([^"']+)["']/gi),
  ].map((match) => match[1]?.toLowerCase());
  if (
    kinds.length === 1 &&
    kinds[0] &&
    ["chart", "diagram", "marketing"].includes(kinds[0])
  ) {
    return [];
  }
  return ["asset must declare data-viz-kind as chart, diagram, or marketing"];
}

function validateSourceLine(source: string): string[] {
  const kind = /\bdata-viz-kind\s*=\s*["']([^"']+)["']/i
    .exec(source)?.[1]
    ?.toLowerCase();
  if (!kind || !["chart", "diagram", "marketing"].includes(kind)) {
    return [];
  }

  const sourceElements = collectSourceElements(source);
  const failures: string[] = [];
  if (sourceElements.length > 1) {
    failures.push("asset must contain exactly one data-viz-source source line");
  }
  if (sourceElements.length === 1) {
    const sourceElement = sourceElements[0];
    if (
      !sourceElement ||
      !sourceElement.textContent.startsWith("Source: ") ||
      sourceElement.textContent.slice("Source: ".length).trim() === ""
    ) {
      failures.push(
        `data-viz-source source line must begin with "Source: " and include non-empty text after the prefix at line ${lineAt(source, sourceElement?.offset ?? 0)}`
      );
    }
  }

  const rootHtml = /<html\b[^>]*>/i.exec(source)?.[0];
  const hasSourceException = rootHtml
    ? /\bdata-viz-source-exception(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>)/i.test(
        rootHtml
      )
    : false;
  const sourceExceptionReason = rootHtml
    ? /\bdata-viz-source-exception-reason\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
        .exec(rootHtml)
        ?.slice(1)
    : undefined;
  const hasSourceExceptionReason = sourceExceptionReason?.some(
    (reason) => reason !== undefined && reason.trim() !== ""
  );
  if (hasSourceException && !hasSourceExceptionReason) {
    failures.push(
      "data-viz-source-exception on root <html> requires a non-empty data-viz-source-exception-reason"
    );
  }
  if (!hasSourceException && hasSourceExceptionReason === true) {
    failures.push(
      "data-viz-source-exception-reason on root <html> requires data-viz-source-exception"
    );
  }
  if (
    kind !== "diagram" &&
    sourceElements.length > 0 &&
    hasSourceExceptionReason === true
  ) {
    failures.push(
      `${kind} assets cannot combine a data-viz-source source line with a declared source exception`
    );
  }

  if (
    kind !== "diagram" &&
    sourceElements.length === 0 &&
    hasSourceExceptionReason !== true
  ) {
    failures.push(
      `${kind} assets require exactly one data-viz-source source line beginning with "Source: " or a declared source exception`
    );
  }
  return failures;
}

type SourceElement = {
  offset: number;
  textContent: string;
};

function collectSourceElements(source: string): SourceElement[] {
  const elements: SourceElement[] = [];
  for (const openingTag of source.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
    const tag = openingTag[0] ?? "";
    if (
      !/\bdata-viz-source(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>)/i.test(
        tag
      )
    ) {
      continue;
    }
    const tagName = openingTag[1] ?? "";
    const openingTagEnd = (openingTag.index ?? 0) + tag.length;
    const closingTag = new RegExp(`</${tagName}\\s*>`, "i").exec(
      source.slice(openingTagEnd)
    );
    const contentStart = openingTagEnd;
    const contentEnd = closingTag
      ? contentStart + (closingTag.index ?? 0)
      : contentStart;
    elements.push({
      offset: openingTag.index ?? 0,
      textContent: source
        .slice(contentStart, contentEnd)
        .replaceAll(/<[^>]*>/g, "")
        .replaceAll(/\s+/g, " ")
        .trimStart(),
    });
  }
  return elements;
}

function validateMarketingAccent(source: string): string[] {
  if (!/data-viz-kind\s*=\s*["']marketing["']/i.test(source)) {
    return [];
  }
  const markedSubjects = new Set(
    [...source.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)]
      .map(
        (match) =>
          /data-viz-subject\s*=\s*["']([^"']+)["']/i.exec(match[0])?.[1]
      )
      .filter((subject): subject is string => subject !== undefined)
  );
  const markedSubjectIdentities = new Set(
    [...source.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)]
      .filter((match) =>
        /data-viz-subject\s*=\s*["'][^"']+["']/i.test(match[0])
      )
      .flatMap((match) => [
        ...(match[0]
          .match(/class\s*=\s*["']([^"']+)["']/i)?.[1]
          ?.split(/\s+/) ?? []),
        ...(match[0].match(/id\s*=\s*["']([^"']+)["']/i)?.[1]?.split(/\s+/) ??
          []),
      ])
  );
  const failures: string[] = [];
  if (markedSubjects.size > 1) {
    failures.push(
      `marketing asset marks ${markedSubjects.size} subjects; at most one is allowed`
    );
  }
  for (const styleBlock of source.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  )) {
    for (const rule of styleBlock[1]?.matchAll(/([^{}]+)\{([^{}]*)\}/g) ?? []) {
      if (ACCENT_TOKENS.test(rule[2] ?? "")) {
        const selector = rule[1]?.trim() ?? "";
        const identities = selector
          .replaceAll(/[.#:[\]()>,+~]/g, " ")
          .split(/\s+/)
          .filter(Boolean);
        if (
          !selector.includes("[data-viz-subject") &&
          !identities.some((identity) => markedSubjectIdentities.has(identity))
        ) {
          failures.push(
            `marketing accent selector ${selector} must target a marked subject`
          );
        }
      }
    }
  }
  for (const tag of source.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
    if (
      ACCENT_TOKENS.test(tag[0]) &&
      !hasDeclaredException(tag[0]) &&
      !/data-viz-subject\s*=\s*["'][^"']+["']/i.test(tag[0])
    ) {
      failures.push(
        `marketing accent on <${tag[1]}> must target a marked subject`
      );
    }
  }
  return failures;
}

function validateTypography(source: string): string[] {
  const failures: string[] = [];
  for (const styleBlock of source.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  )) {
    for (const declaration of styleBlock[1]?.matchAll(
      /font-family\s*:\s*([^;}]+)/gi
    ) ?? []) {
      if (
        !BRAND_FONT.test(declaration[1] ?? "") &&
        !MONO_FONT.test(declaration[1] ?? "")
      ) {
        failures.push(
          `font-family is not var(--font-sans) or var(--font-mono) at line ${lineAt(source, styleBodyOffset(styleBlock, styleBlock[1] ?? "") + (declaration.index ?? 0))}`
        );
      }
    }
  }
  for (const styleAttribute of source.matchAll(
    /style\s*=\s*["']([^"']+)["']/gi
  )) {
    for (const declaration of styleAttribute[1]?.matchAll(
      /font-family\s*:\s*([^;]+)/gi
    ) ?? []) {
      if (
        !BRAND_FONT.test(declaration[1] ?? "") &&
        !MONO_FONT.test(declaration[1] ?? "")
      ) {
        failures.push(
          `font-family is not var(--font-sans) or var(--font-mono) at line ${lineAt(source, styleAttributeValueOffset(styleAttribute) + (declaration.index ?? 0))}`
        );
      }
    }
  }
  return failures;
}

function validateCustomProperties(source: string): string[] {
  const failures: string[] = [];
  for (const styleBlock of source.matchAll(
    /<style\b([^>]*)>([\s\S]*?)<\/style>/gi
  )) {
    if (
      /data-viz-tokens\s*=\s*["']authoritative["']/i.test(styleBlock[1] ?? "")
    ) {
      continue;
    }
    for (const declaration of styleBlock[2]?.matchAll(
      /(--[\w-]+)\s*:\s*([^;}]+)/g
    ) ?? []) {
      const value = declaration[2]?.trim() ?? "";
      if (
        /#(?:[0-9a-f]{3,8})\b/i.test(stripWrappedComponentColorTokens(value)) ||
        NAMED_COLORS.test(stripWrappedComponentColorTokens(value)) ||
        /\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/i.test(
          stripWrappedComponentColorTokens(value)
        )
      ) {
        failures.push(
          `literal color in custom property ${declaration[1]} at line ${lineAt(source, styleBodyOffset(styleBlock, styleBlock[2] ?? "") + (declaration.index ?? 0))}`
        );
      }
    }
  }
  return failures;
}

function validateExceptions(source: string): string[] {
  return [
    ...source.matchAll(
      /<([a-z][\w:-]*)\b[^>]*data-viz-exception\s*=\s*["']([^"']+)["'][^>]*>/gi
    ),
  ]
    .filter((match) => {
      const reason = /data-viz-exception-reason\s*=\s*["']([^"']+)["']/i
        .exec(match[0])?.[1]
        ?.trim();
      return !reason;
    })
    .map(
      (match) => `exception on <${match[1]}> requires data-viz-exception-reason`
    );
}

function validateColors(source: string): string[] {
  const isChart = /data-viz-kind\s*=\s*["']chart["']/i.test(source);
  const isMarketing = /data-viz-kind\s*=\s*["']marketing["']/i.test(source);
  const failures: string[] = [];
  for (const position of collectColorPositions(source)) {
    if (position.exception) {
      continue;
    }
    if (
      position.origin === "presentation-attribute" &&
      /var\(--/i.test(position.value)
    ) {
      failures.push(
        `token reference in presentation attribute at line ${lineAt(source, position.offset)}; use a stylesheet declaration instead`
      );
    }
    const valueWithoutFragmentPaint = position.value.replaceAll(
      /url\(\s*#[^)]+\)/gi,
      ""
    );
    if (/#(?:[0-9a-f]{3,8})\b/i.test(valueWithoutFragmentPaint)) {
      failures.push(
        `raw hex ${position.value} at line ${lineAt(source, position.offset)}`
      );
    }
    if (NAMED_COLORS.test(valueWithoutFragmentPaint)) {
      failures.push(
        `named color ${position.value} at line ${lineAt(source, position.offset)}`
      );
    }
    if (isChart && !isMarketing && ACCENT_TOKENS.test(position.value)) {
      failures.push(
        `accent token in chart color position at line ${lineAt(source, position.offset)}`
      );
    }
    for (const alphaMatch of position.value.matchAll(
      /(?:hsl|hsla)\([^/]*\/\s*([0-9.]+)(%?)\s*\)/gi
    )) {
      const alpha = normalizeOpacity(
        alphaMatch[1] ?? "",
        alphaMatch[2] === "%"
      );
      const allowed = position.isAreaFill
        ? AREA_FILL_OPACITIES
        : GENERAL_OPACITIES;
      if (!allowed.has(alpha)) {
        failures.push(
          `unsanctioned color alpha ${alpha} at line ${lineAt(source, position.offset)}`
        );
      }
    }
    if (
      CHART_TOKENS.test(position.value) &&
      /hsl\(\s*var\(--chart-/i.test(position.value)
    ) {
      failures.push(
        `chart token must be used directly, not wrapped in hsl(), at line ${lineAt(source, position.offset)}`
      );
    }
    if (
      /hsl\(\s*var\(--(?:positive|negative|warning)(?:-text|-bg)?\)/i.test(
        position.value
      )
    ) {
      failures.push(
        `status token must be used directly, not wrapped in hsl(), at line ${lineAt(source, position.offset)}`
      );
    }
    const withoutWrappedHslTokens = position.value.replaceAll(
      /hsl\(\s*var\(--(?:background|foreground|muted-foreground|border|primary|accent|accent-foreground)\)(?:\s*\/\s*[^)]+)?\s*\)/gi,
      ""
    );
    if (HSL_TOKENS.test(withoutWrappedHslTokens)) {
      failures.push(
        `HSL token must be wrapped in hsl() at line ${lineAt(source, position.offset)}`
      );
    }
    if (
      FAINT_TEXT_TOKEN.test(position.value) &&
      position.value.trim() !== "var(--text-faint)"
    ) {
      failures.push(
        `faint text token must be used directly at line ${lineAt(source, position.offset)}`
      );
    }
    if (
      /\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/i.test(
        stripWrappedComponentColorTokens(position.value)
      )
    ) {
      failures.push(
        `literal color function ${position.value} at line ${lineAt(source, position.offset)}`
      );
    }
  }
  return failures;
}

function validateOpacity(source: string): string[] {
  const failures: string[] = [];
  for (const match of source.matchAll(
    /(?<![\w-])(?:fill-opacity|fillOpacity|stroke-opacity|strokeOpacity|stop-opacity|stopOpacity|opacity)\s*=\s*["']?([0-9.]+)(%?)/gi
  )) {
    const property = match[0].split(/[:=]/, 1)[0]?.trim().toLowerCase();
    const opacity = normalizeOpacity(match[1] ?? "", match[2] === "%");
    const isIdentifiedAreaFill =
      (property === "fill-opacity" ||
        property === "fillopacity" ||
        property === "stop-opacity" ||
        property === "stopopacity") &&
      isAreaElementAt(source, match.index ?? 0);
    addOpacityFailure({
      source,
      failures,
      opacity,
      offset: match.index ?? 0,
      isIdentifiedAreaFill,
    });
  }
  for (const match of source.matchAll(/style\s*=\s*["']([^"']+)["']/gi)) {
    for (const opacityMatch of match[1]?.matchAll(
      /(?<![\w-])(?:fill-opacity|fillOpacity|stroke-opacity|strokeOpacity|stop-opacity|stopOpacity|opacity)\s*:\s*([0-9.]+)(%?)/gi
    ) ?? []) {
      const property = opacityMatch[0].split(":", 1)[0]?.trim().toLowerCase();
      const isIdentifiedAreaFill =
        (property === "fill-opacity" ||
          property === "fillopacity" ||
          property === "stop-opacity" ||
          property === "stopopacity") &&
        isAreaElementAt(source, match.index ?? 0);
      addOpacityFailure({
        source,
        failures,
        opacity: normalizeOpacity(
          opacityMatch[1] ?? "",
          opacityMatch[2] === "%"
        ),
        offset: styleAttributeValueOffset(match) + (opacityMatch.index ?? 0),
        isIdentifiedAreaFill,
      });
    }
  }
  for (const styleBlock of source.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  )) {
    for (const rule of styleBlock[1]?.matchAll(/([^{}]+)\{([^{}]*)\}/g) ?? []) {
      const selector = rule[1]?.trim() ?? "";
      for (const match of rule[2]?.matchAll(
        /(?<![\w-])(?:fill-opacity|fillOpacity|stroke-opacity|strokeOpacity|stop-opacity|stopOpacity|opacity)\s*:\s*([0-9.]+)(%?)/gi
      ) ?? []) {
        const property = match[0].split(":", 1)[0]?.trim().toLowerCase();
        const opacity = normalizeOpacity(match[1] ?? "", match[2] === "%");
        const isIdentifiedAreaFill =
          (property === "fill-opacity" ||
            property === "fillopacity" ||
            property === "stop-opacity" ||
            property === "stopopacity") &&
          isAreaIdentity(selector);
        addOpacityFailure({
          source,
          failures,
          opacity,
          offset:
            styleBodyOffset(styleBlock, styleBlock[1] ?? "") +
            (rule.index ?? 0) +
            (rule[0]?.indexOf(rule[2] ?? "") ?? 0) +
            (match.index ?? 0),
          isIdentifiedAreaFill,
        });
      }
    }
  }
  return failures;
}

function addOpacityFailure({
  source,
  failures,
  opacity,
  offset,
  isIdentifiedAreaFill,
}: {
  source: string;
  failures: string[];
  opacity: number;
  offset: number;
  isIdentifiedAreaFill: boolean;
}): void {
  const allowed = isIdentifiedAreaFill
    ? AREA_FILL_OPACITIES
    : GENERAL_OPACITIES;
  if (allowed.has(opacity)) {
    return;
  }
  const role = isIdentifiedAreaFill ? "area fill" : "dimming or stroke";
  failures.push(
    `unsanctioned ${role} opacity ${opacity} at line ${lineAt(source, offset)}`
  );
}

function normalizeOpacity(value: string, isPercent: boolean): number {
  const parsed = Number(value);
  return isPercent ? parsed / 100 : parsed;
}

function isAreaElementAt(source: string, offset: number): boolean {
  const elementStart = source.lastIndexOf("<", offset);
  const element = source.slice(
    elementStart,
    source.indexOf(">", elementStart) + 1
  );
  return (
    /^<stop\b/i.test(element) || isAreaIdentity(extractIdentities(element))
  );
}

function isAreaIdentity(value: string): boolean {
  return /(?:^|[\s.#:[\]()>~,_-])(?:area|band|fill|gradient|stop)(?:[-_:\s.]|$)/i.test(
    value
  );
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function styleBodyOffset(
  styleBlock: RegExpMatchArray,
  content: string
): number {
  return (styleBlock.index ?? 0) + styleBlock[0].indexOf(content);
}

function validateChrome(source: string): string[] {
  const failures: string[] = [];
  for (const match of source.matchAll(
    /<[^>]*\b(?:class|id|data-[\w-]+)\s*=\s*["'][^"']+["'][^>]*>/gi
  )) {
    const element = match[0];
    if (!isChromeIdentity(element, false)) {
      continue;
    }
    if (hasDeclaredException(element)) {
      continue;
    }
    const elementWithoutStyles = element.replaceAll(
      /\sstyle\s*=\s*["'][^"']*["']/gi,
      ""
    );
    for (const paint of elementWithoutStyles.matchAll(
      new RegExp(
        `(?:^|[\\s"'])(${COLOR_PROPERTY_PATTERN})(?![-\\w])\\s*[=:]\\s*["']?([^"'>]+)["']?`,
        "gi"
      )
    )) {
      if (!isNeutralChromePaint(paint[2] ?? "", paint[1] ?? "", element)) {
        failures.push(
          `axis or grid chrome does not use a neutral token at line ${lineAt(source, match.index ?? 0)}`
        );
      }
    }
    for (const styleAttribute of element.matchAll(
      /style\s*=\s*["']([^"']*)["']/gi
    )) {
      for (const paint of styleAttribute[1]?.matchAll(
        new RegExp(
          `(?:^|;)\\s*(${COLOR_PROPERTY_PATTERN})(?![-\\w])\\s*:\\s*([^;]+)`,
          "gi"
        )
      ) ?? []) {
        if (
          !isNeutralChromePaint(paint[2]?.trim() ?? "", paint[1] ?? "", element)
        ) {
          failures.push(
            `axis or grid chrome does not use a neutral token at line ${lineAt(source, match.index ?? 0)}`
          );
        }
      }
    }
  }
  for (const styleBlock of source.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  )) {
    for (const rule of styleBlock[1]?.matchAll(/([^{}]+)\{([^{}]*)\}/g) ?? []) {
      const selector = rule[1]?.trim() ?? "";
      if (!isChromeIdentity(selector, true)) {
        continue;
      }
      const declarations = rule[2] ?? "";
      for (const declaration of declarations.matchAll(
        new RegExp(
          `(?:^|;)\\s*(stroke|fill|color|background(?:-color)?|${COLOR_PROPERTY_PATTERN})\\s*:\\s*([^;]+)`,
          "gi"
        )
      )) {
        const property = declaration[1]?.trim() ?? "";
        const value = declaration[2]?.trim() ?? "";
        if (!isNeutralChromePaint(value, property, selector)) {
          failures.push(
            `stylesheet chrome selector ${selector} is not neutral`
          );
        }
      }
    }
  }
  return failures;
}

function isChromeIdentity(value: string, allowRawFallback = false): boolean {
  const identities = extractIdentities(value);
  if (!identities && !allowRawFallback) {
    return false;
  }
  return (identities || value)
    .replaceAll(/[.#:[\]()>,+~]/g, " ")
    .split(/\s+/)
    .flatMap((identity) => splitIdentityWords(identity))
    .some((identity) =>
      /^(?:axis|axes|grid|grids|gridline|gridlines|tick|ticks|reference|references|connector|connectors|wire|wires|arrow|arrows)$/i.test(
        identity
      )
    );
}

function stripWrappedComponentColorTokens(value: string): string {
  return value.replaceAll(
    /hsl\(\s*var\(--[\w-]+\)(?:\s*\/\s*[^)]+)?\s*\)/gi,
    ""
  );
}

function extractIdentities(value: string): string {
  return [
    ...value.matchAll(
      /(?:class|id|data-(?:viz-role|viz-name))\s*=\s*["']([^"']+)["']/gi
    ),
  ]
    .map((match) => match[1] ?? "")
    .join(" ");
}

function splitIdentityWords(value: string): string[] {
  return value
    .replaceAll(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .filter(Boolean);
}

function hasDeclaredException(element: string): boolean {
  return (
    /data-viz-exception\s*=\s*["'][^"']+["']/i.test(element) &&
    /data-viz-exception-reason\s*=\s*["'][^"']+["']/i.test(element)
  );
}

function isNeutralChromePaint(
  value: string,
  property: string,
  element: string
): boolean {
  if (/^(?:none|transparent)$/i.test(value)) {
    return true;
  }
  const tokenNames = [...value.matchAll(/var\(--([\w-]+)\)/gi)].map((match) =>
    match[1]?.toLowerCase()
  );
  const hasOnlyNeutralTokens = tokenNames.every((name) =>
    ["background", "border", "muted-foreground"].includes(name ?? "")
  );
  if (
    /hsl\(\s*var\(--foreground\)\s*\)/i.test(value) &&
    (property === "color" ||
      (property === "fill" &&
        (/<text\b/i.test(element) || isTextChromeIdentity(element))))
  ) {
    return tokenNames.length === 1 && tokenNames[0] === "foreground";
  }
  return (
    hasOnlyNeutralTokens &&
    tokenNames.length > 0 &&
    /(?:color-mix|hsl)\(/i.test(value)
  );
}

function isTextChromeIdentity(value: string): boolean {
  const identities = extractIdentities(value);
  if (!identities && value.startsWith("<")) {
    return false;
  }
  return (identities || value)
    .replaceAll(/[.#:[\]()>,+~]/g, " ")
    .split(/\s+/)
    .flatMap((identity) => splitIdentityWords(identity))
    .some((identity) =>
      /^(?:label|labels|text|title|titles|caption|captions)$/i.test(identity)
    );
}

function collectColorPositions(source: string): ColorPosition[] {
  const positions: ColorPosition[] = [];
  for (const match of source.matchAll(
    new RegExp(`\\b${COLOR_PROPERTY_PATTERN}\\s*=\\s*["']([^"']+)["']`, "gi")
  )) {
    positions.push({
      value: match[1] ?? "",
      offset: match.index ?? 0,
      exception: hasException(source, match.index ?? 0),
      isAreaFill: isAreaElementAt(source, match.index ?? 0),
      origin: "presentation-attribute",
    });
  }
  for (const match of source.matchAll(/style\s*=\s*["']([^"']+)["']/gi)) {
    for (const declaration of match[1]?.matchAll(
      new RegExp(`(?:^|;)\\s*${COLOR_PROPERTY_PATTERN}\\s*:\\s*([^;]+)`, "gi")
    ) ?? []) {
      positions.push({
        value: declaration[1]?.trim() ?? "",
        offset:
          styleAttributeValueOffset(match) +
          (declaration.index ?? 0) +
          (declaration[0]?.indexOf(declaration[1] ?? "") ?? 0),
        exception: hasException(source, match.index ?? 0),
        isAreaFill: isAreaElementAt(source, match.index ?? 0),
        origin: "inline-style",
      });
    }
  }
  const exceptionIdentities = collectExceptionIdentities(source);
  for (const styleBlock of source.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  )) {
    for (const declaration of styleBlock[1]?.matchAll(
      new RegExp(
        `(?:^|[;{])\\s*${COLOR_PROPERTY_PATTERN}\\s*:\\s*([^;}]+)`,
        "gi"
      )
    ) ?? []) {
      positions.push({
        value: declaration[1]?.trim() ?? "",
        offset:
          styleBodyOffset(styleBlock, styleBlock[1] ?? "") +
          (declaration.index ?? 0) +
          (declaration[0]?.indexOf(declaration[1] ?? "") ?? 0),
        exception: selectorTargetsException(
          ruleSelectorAt(source, styleBlock, declaration.index ?? 0),
          exceptionIdentities
        ),
        isAreaFill: isAreaIdentity(
          ruleSelectorAt(source, styleBlock, declaration.index ?? 0)
        ),
        origin: "stylesheet",
      });
    }
  }
  return positions;
}

function styleAttributeValueOffset(styleAttribute: RegExpMatchArray): number {
  return (
    (styleAttribute.index ?? 0) +
    styleAttribute[0].indexOf(styleAttribute[1] ?? "")
  );
}

function collectExceptionIdentities(source: string): Map<string, boolean> {
  const identities = new Map<string, boolean>();
  for (const match of source.matchAll(/<[^>]+>/gi)) {
    const declared = hasDeclaredException(match[0]);
    for (const identity of match[0].matchAll(
      /(?:class|id)\s*=\s*["']([^"']+)["']/gi
    )) {
      for (const name of (identity[1] ?? "").split(/\s+/).filter(Boolean)) {
        identities.set(name, (identities.get(name) ?? true) && declared);
      }
    }
  }
  return identities;
}

function selectorTargetsException(
  selector: string,
  exceptionIdentities: Map<string, boolean>
): boolean {
  return [...selector.matchAll(/[.#]([\w-]+)/g)].some(
    (identity) => exceptionIdentities.get(identity[1] ?? "") === true
  );
}

function ruleSelectorAt(
  source: string,
  styleBlock: RegExpMatchArray,
  declarationOffset: number
): string {
  const bodyOffset = styleBodyOffset(styleBlock, styleBlock[1] ?? "");
  const beforeDeclaration = source.slice(
    bodyOffset,
    bodyOffset + declarationOffset
  );
  return (
    beforeDeclaration
      .slice(beforeDeclaration.lastIndexOf("}") + 1)
      .split("{")[0]
      ?.trim() ?? ""
  );
}

function hasException(source: string, offset: number): boolean {
  const openingTagStart = source.lastIndexOf("<", offset);
  const openingTagEnd = source.indexOf(">", openingTagStart);
  if (openingTagStart === -1 || openingTagEnd < offset) {
    return false;
  }
  const tag = source.slice(openingTagStart, openingTagEnd + 1);
  return (
    /data-viz-exception\s*=\s*["'][^"']+["']/i.test(tag) &&
    /data-viz-exception-reason\s*=\s*["'][^"']+["']/i.test(tag)
  );
}

function stripComments(value: string): string {
  return value
    .replaceAll(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replaceAll(/[^\n]/g, " ")
    )
    .replaceAll(/<!--[\s\S]*?-->/g, (comment) =>
      comment.replaceAll(/[^\n]/g, " ")
    );
}

if (import.meta.main) {
  await validateVizAsset();
}
