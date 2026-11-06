import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { CaptureRecord } from "./viz-capture-assertions";

import { findVizAssetFailures } from "./validate-viz-asset";
import { assertThemeCapturesDiffer } from "./viz-capture-assertions";

const fixturesDirectory = fileURLToPath(
  new URL("../examples/validator-fixtures/", import.meta.url)
);
const examplesDirectory = fileURLToPath(
  new URL("../examples/examples/", import.meta.url)
);
const socialExamplesDirectory = fileURLToPath(
  new URL("../examples/social-examples/", import.meta.url)
);

describe("findVizAssetFailures", () => {
  test("accepts the sanctioned opacity, label, and declared specimen cases", async () => {
    const source = await readFile(`${fixturesDirectory}accepted.html`, "utf8");

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("reports each deliberately invalid fixture finding", async () => {
    const source = await readFile(`${fixturesDirectory}rejected.html`, "utf8");
    const failures = findVizAssetFailures(source);

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("raw hex #666"),
        expect.stringContaining("unsanctioned area fill opacity 0.08"),
        expect.stringContaining(
          "stylesheet chrome selector .axis-line is not neutral"
        ),
        expect.stringContaining(
          "font-family is not var(--font-sans) or var(--font-mono)"
        ),
        expect.stringContaining("faint text token must be used directly"),
        expect.stringContaining("HSL token must be wrapped"),
        expect.stringContaining("literal color in custom property"),
        expect.stringContaining(
          "stylesheet chrome selector .gridlines-bad is not neutral"
        ),
        expect.stringContaining(
          "stylesheet chrome selector .chart-axis-bad is not neutral"
        ),
        expect.stringContaining(
          "stylesheet chrome selector .prefixed-gridline-bad is not neutral"
        ),
        expect.stringContaining(
          "stylesheet chrome selector .compound-axis-line-bad is not neutral"
        ),
        expect.stringContaining(
          "stylesheet chrome selector .axis-mixed-neutral-data is not neutral"
        ),
        expect.stringContaining("raw hex 1px solid #abcdef"),
        expect.stringContaining("raw hex #123456"),
        expect.stringContaining("named color rebeccapurple"),
        expect.stringContaining("token reference in presentation attribute"),
        expect.stringContaining("accent token in chart color position"),
        expect.stringContaining(
          "stylesheet chrome selector .connector-bad is not neutral"
        ),
        expect.stringContaining(
          'chart assets require exactly one data-viz-source source line beginning with "Source: " or a declared source exception'
        ),
      ])
    );
    expect(failures).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "literal color function hsl(var(--text-faint))"
        ),
      ])
    );
  });

  test("accepts wrapped component surface tokens as theme colors", () => {
    const source = `<html data-viz-kind="chart">
<style>circle { fill: hsl(var(--card) / 0.12); }</style>
<svg><circle></circle></svg>
<p data-viz-source>Source: Example internal data, Aug 2026</p>
</html>`;

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("accepts bare status tokens and rejects them wrapped in hsl()", () => {
    const chart = (paint: string): string => `<html data-viz-kind="chart">
<style>path { stroke: ${paint}; }</style>
<svg><path></path></svg>
<p data-viz-source>Source: Example internal data, Aug 2026</p>
</html>`;

    expect(findVizAssetFailures(chart("var(--negative)"))).toEqual([]);
    expect(findVizAssetFailures(chart("hsl(var(--negative-text))"))).toContain(
      "status token must be used directly, not wrapped in hsl(), at line 2"
    );
  });

  test("accepts a valid chart source line", () => {
    const source = `<html data-viz-kind="chart">
<p data-viz-source>Source: Example internal data, Aug 2026</p>
</html>`;

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("rejects a chart without a source line", () => {
    expect(
      findVizAssetFailures('<html data-viz-kind="chart"></html>')
    ).toContain(
      'chart assets require exactly one data-viz-source source line beginning with "Source: " or a declared source exception'
    );
  });

  test("rejects empty and malformed source lines", () => {
    const empty = `<html data-viz-kind="chart">
<p data-viz-source></p>
</html>`;
    const malformed = `<html data-viz-kind="chart">
<p data-viz-source>Example internal data</p>
</html>`;
    const missingAttribution = `<html data-viz-kind="chart">
<p data-viz-source>Source: </p>
<span>outside the source element</span>
</html>`;
    const whitespaceAttribution = `<html data-viz-kind="chart">
<p data-viz-source>Source: \t</p>
</html>`;

    expect(findVizAssetFailures(empty)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'data-viz-source source line must begin with "Source: " and include non-empty text after the prefix'
        ),
      ])
    );
    expect(findVizAssetFailures(malformed)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'data-viz-source source line must begin with "Source: " and include non-empty text after the prefix'
        ),
      ])
    );
    expect(findVizAssetFailures(missingAttribution)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'data-viz-source source line must begin with "Source: " and include non-empty text after the prefix'
        ),
      ])
    );
    expect(findVizAssetFailures(whitespaceAttribution)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'data-viz-source source line must begin with "Source: " and include non-empty text after the prefix'
        ),
      ])
    );
  });

  test("reports the source-line violation line number", () => {
    const source = `<html data-viz-kind="chart">
<section>
<p data-viz-source>Example internal data</p>
</section>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      'data-viz-source source line must begin with "Source: " and include non-empty text after the prefix at line 3'
    );
  });

  test("accepts source text nested inside markup", () => {
    const source = `<html data-viz-kind="chart">
<p data-viz-source><span>Source: Example internal data</span></p>
</html>`;

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("accepts source attributes with values", () => {
    const source = `<html data-viz-kind="chart">
<p data-viz-source="true">Source: Example internal data</p>
</html>`;

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("rejects duplicate source lines", () => {
    const source = `<html data-viz-kind="chart">
<p data-viz-source>Source: Example internal data, Aug 2026</p>
<p data-viz-source>Source: Example internal data, Aug 2026</p>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "asset must contain exactly one data-viz-source source line"
    );
  });

  test("exempts diagrams from the source-line requirement", () => {
    expect(
      findVizAssetFailures('<html data-viz-kind="diagram"></html>')
    ).toEqual([]);
  });

  test("accepts a declared source exception on the root html element", () => {
    const source = `<html data-viz-kind="chart" data-viz-source-exception data-viz-source-exception-reason="Illustrative synthetic data">
</html>`;

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("accepts valued and quoted source exception attributes", () => {
    const sources = [
      `<html data-viz-kind="chart" data-viz-source-exception="enabled" data-viz-source-exception-reason = "Illustrative synthetic data">
</html>`,
      `<html data-viz-kind="chart" data-viz-source-exception-reason=synthetic data-viz-source-exception>
</html>`,
      `<html data-viz-kind="chart" data-viz-source-exception-reason='Illustrative synthetic data' data-viz-source-exception>
</html>`,
    ];

    for (const source of sources) {
      expect(findVizAssetFailures(source)).toEqual([]);
    }
  });

  test("rejects a source exception reason without its marker", () => {
    const source = `<html data-viz-kind="chart" data-viz-source-exception-reason="Illustrative synthetic data">
</html>`;
    const failures = findVizAssetFailures(source);

    expect(failures).toEqual([
      "data-viz-source-exception-reason on root <html> requires data-viz-source-exception",
    ]);
  });

  test("rejects a chart that combines a source line and source exception", () => {
    const source = `<html data-viz-kind="chart" data-viz-source-exception data-viz-source-exception-reason="Illustrative synthetic data">
<p data-viz-source>Source: Example internal data</p>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "chart assets cannot combine a data-viz-source source line with a declared source exception"
    );
  });

  test("rejects empty source exception reasons", () => {
    for (const reason of ["", "   "]) {
      const source = `<html data-viz-kind="chart" data-viz-source-exception data-viz-source-exception-reason="${reason}">
</html>`;
      const failures = findVizAssetFailures(source);

      expect(failures).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "data-viz-source-exception on root <html> requires a non-empty data-viz-source-exception-reason"
          ),
          expect.stringContaining(
            'chart assets require exactly one data-viz-source source line beginning with "Source: " or a declared source exception'
          ),
        ])
      );
    }
  });

  test("accepts every canonical example in the manifest", async () => {
    for (const directory of [examplesDirectory, socialExamplesDirectory]) {
      const manifestValue: unknown = JSON.parse(
        await readFile(`${directory}manifest.json`, "utf8")
      );
      assertStringArray(manifestValue);
      for (const filename of manifestValue) {
        const source = await readFile(`${directory}${filename}`, "utf8");
        expect(findVizAssetFailures(source)).toEqual([]);
      }
    }
  });

  test("limits marketing accent use to one subject", async () => {
    const accepted = await readFile(
      `${fixturesDirectory}accepted-marketing.html`,
      "utf8"
    );
    const rejected = await readFile(
      `${fixturesDirectory}rejected-marketing.html`,
      "utf8"
    );

    expect(findVizAssetFailures(accepted)).toEqual([]);
    expect(findVizAssetFailures(rejected)).toContain(
      "marketing asset marks 4 subjects; at most one is allowed"
    );
  });

  test("rejects an accent attribute on an unmarked marketing element", () => {
    const source = `<html data-viz-kind="marketing">
<svg><circle fill="var(--accent)"></circle></svg>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "marketing accent on <circle> must target a marked subject"
    );
  });

  test("requires one recognized asset kind marker", () => {
    expect(findVizAssetFailures("<html></html>")).toContain(
      "asset must declare data-viz-kind as chart, diagram, or marketing"
    );
    expect(
      findVizAssetFailures('<html data-viz-kind="chartz"></html>')
    ).toContain(
      "asset must declare data-viz-kind as chart, diagram, or marketing"
    );
    expect(
      findVizAssetFailures('<html data-viz-kind="chartz"></html>')
    ).toEqual([
      "asset must declare data-viz-kind as chart, diagram, or marketing",
    ]);
    expect(
      findVizAssetFailures('<html data-viz-kind = "chart"></html>')
    ).toContain(
      'chart assets require exactly one data-viz-source source line beginning with "Source: " or a declared source exception'
    );
  });

  test("does not require a root html element for source validation", () => {
    const source = `<div data-viz-kind="chart">
<p data-viz-source>Source: Example internal data</p>
</div>`;

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("reports original source line numbers", async () => {
    const source = await readFile(`${fixturesDirectory}rejected.html`, "utf8");

    expect(findVizAssetFailures(source)).toContain("raw hex #666 at line 22");
  });

  test("reports stylesheet opacity on the declaration line", () => {
    const source = `<html data-viz-kind="chart">
<style>
.area
.band {
  fill-opacity: 0.08;
}
</style>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "unsanctioned area fill opacity 0.08 at line 5"
    );
  });

  test("recognizes hyphenated and underscored area identities", () => {
    const accepted = `<html data-viz-kind="chart">
<svg>
  <rect class="bar-area" style="fill-opacity: 0.12"></rect>
  <rect class="plot_area" style="fill-opacity: 0.4"></rect>
  <rect class="areaish" style="fill-opacity: 0.12"></rect>
</svg>
<p data-viz-source>Source: Example internal data, Aug 2026</p>
</html>`;
    const rejected = `<html data-viz-kind="chart">
<svg><rect class="plot-area" style="fill-opacity: 0.08"></rect></svg>
</html>`;

    expect(findVizAssetFailures(accepted)).toEqual([]);
    expect(findVizAssetFailures(rejected)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unsanctioned area fill opacity 0.08"),
      ])
    );
  });

  test("reports stylesheet color on the declaration line", () => {
    const source = `<html data-viz-kind="chart">
<style>
.bad-stroke {
  stroke: #666;
}
</style>
</html>`;

    expect(findVizAssetFailures(source)).toContain("raw hex #666 at line 4");
  });

  test("collects border color longhands in every color-position path", () => {
    const source = `<html data-viz-kind="diagram">
<style>.axis-line { border-left-color: #123456; }</style>
<svg><path class="axis-line" border-top-color="#123456" style="border-right-color: #123456"></path></svg>
</html>`;

    expect(
      findVizAssetFailures(source).filter((failure) =>
        failure.includes("raw hex")
      )
    ).toHaveLength(3);
  });

  test("rejects unsanctioned alpha in a component color value", () => {
    const source = `<html data-viz-kind="diagram">
<style>.panel { background: hsl(var(--background) / 0.5); }</style>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "unsanctioned color alpha 0.5 at line 2"
    );
  });

  test("uses area opacity levels consistently for color alpha and opacity properties", () => {
    const accepted = `<html data-viz-kind="chart">
<style>
.area { fill: hsl(var(--background) / 0.35); fill-opacity: 0.35; }
.point { fill: hsl(var(--background) / 0.28); fill-opacity: 0.28; }
</style>
<p data-viz-source>Source: Example internal data, Aug 2026</p>
</html>`;
    const rejected = `<html data-viz-kind="chart">
<style>
.area { fill: hsl(var(--background) / 0.28); fill-opacity: 0.28; }
.point { fill: hsl(var(--background) / 0.35); fill-opacity: 0.35; }
</style>
</html>`;

    expect(findVizAssetFailures(accepted)).toEqual([]);
    expect(findVizAssetFailures(rejected)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unsanctioned color alpha 0.28"),
        expect.stringContaining("unsanctioned area fill opacity 0.28"),
        expect.stringContaining("unsanctioned color alpha 0.35"),
        expect.stringContaining("unsanctioned dimming or stroke opacity 0.35"),
      ])
    );
  });

  test("enforces neutral background and border paints on chrome", () => {
    const accepted = `<html data-viz-kind="diagram">
<style>.arrow { background: hsl(var(--muted-foreground)); border-color: hsl(var(--border)); }</style>
<svg><path class="arrow"></path></svg>
</html>`;
    const rejected = `<html data-viz-kind="diagram">
<style>.arrow { background: var(--chart-1); }</style>
<svg><path class="arrow"></path></svg>
</html>`;

    expect(findVizAssetFailures(accepted)).toEqual([]);
    expect(findVizAssetFailures(rejected)).toContain(
      "stylesheet chrome selector .arrow is not neutral"
    );
  });

  test("rejects token-bearing presentation attributes and ignores prose identities", () => {
    const source = `<html data-viz-kind="chart">
<svg>
  <circle aria-label="axis reference" fill="color-mix(in srgb, var(--chart-1) 50%, hsl(var(--border)))"></circle>
  <path stroke="hsl(var(--border))"></path>
</svg>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "token reference in presentation attribute at line 3; use a stylesheet declaration instead"
    );
    expect(findVizAssetFailures(source)).not.toContain(
      "axis or grid chrome does not use a neutral token at line 3"
    );
  });

  test("checks every inline chrome paint declaration", () => {
    const rejected = `<html data-viz-kind="chart">
<svg><path class="gridline" style="stroke: hsl(var(--border)); fill: red;"></path></svg>
</html>`;
    const accepted = `<html data-viz-kind="chart">
<svg><path class="gridline" style="stroke: hsl(var(--border)); fill: hsl(var(--border));"></path></svg>
<p data-viz-source>Source: Example internal data, Aug 2026</p>
</html>`;

    expect(findVizAssetFailures(rejected)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "axis or grid chrome does not use a neutral token at line 2"
        ),
      ])
    );
    expect(findVizAssetFailures(accepted)).toEqual([]);
  });

  test("ignores fragment paints with non-hex identifier suffixes", () => {
    const source = `<html data-viz-kind="diagram">
<style>.paint { fill: url(#deadbeef-gradient); }</style>
<svg><path class="paint"></path></svg>
</html>`;

    expect(findVizAssetFailures(source)).toEqual([]);
  });

  test("ignores named-color words in fragment identifiers but rejects actual named colors", () => {
    const source = `<html data-viz-kind="diagram">
<style>
.fragment { fill: url(#area-gradient-blue); }
.named { fill: tan; }
</style>
<svg><path class="fragment"></path><path class="named"></path></svg>
</html>`;
    const failures = findVizAssetFailures(source);

    expect(failures).toEqual(
      expect.arrayContaining([expect.stringContaining("named color tan")])
    );
    expect(failures).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("named color url(#area-gradient-blue)"),
      ])
    );
  });

  test("applies literal-color exceptions to targeted stylesheet selectors", () => {
    const accepted = `<html data-viz-kind="diagram">
<style>.swatch { fill: #4F46E5; }</style>
<svg><rect class="swatch" data-viz-exception="palette" data-viz-exception-reason="specimen"></rect></svg>
</html>`;
    const rejected = `<html data-viz-kind="diagram">
<style>.swatch { fill: #4F46E5; }</style>
<svg><rect class="swatch"></rect></svg>
</html>`;

    expect(findVizAssetFailures(accepted)).toEqual([]);
    expect(findVizAssetFailures(rejected)).toContain(
      "raw hex #4F46E5 at line 2"
    );
  });

  test("only applies a class exception when every matching element declares it", () => {
    const accepted = `<html data-viz-kind="diagram">
<style>.swatch { fill: #4F46E5; }</style>
<svg><rect class="swatch" data-viz-exception="palette" data-viz-exception-reason="specimen"></rect></svg>
</html>`;
    const shared = `<html data-viz-kind="diagram">
<style>.swatch { fill: #4F46E5; }</style>
<svg>
  <rect class="swatch" data-viz-exception="palette" data-viz-exception-reason="specimen"></rect>
  <rect class="swatch"></rect>
</svg>
</html>`;

    expect(findVizAssetFailures(accepted)).toEqual([]);
    expect(findVizAssetFailures(shared)).toContain("raw hex #4F46E5 at line 2");
  });

  test("reports inline-style typography on the declaration line", () => {
    const source = `<html data-viz-kind="chart">
<svg>
  <text style="
    font-family: Arial;
  ">Label</text>
</svg>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "font-family is not var(--font-sans) or var(--font-mono) at line 4"
    );
  });

  test("reports inline-style opacity on the declaration line", () => {
    const source = `<html data-viz-kind="chart">
<svg>
  <rect style="
    opacity: 0.08;
  "></rect>
</svg>
</html>`;

    expect(findVizAssetFailures(source)).toContain(
      "unsanctioned dimming or stroke opacity 0.08 at line 4"
    );
  });
});

describe("assertThemeCapturesDiffer", () => {
  const base = {
    asset: "chart",
    sha256: "light-hash",
    themeProbe: "rgb(252, 252, 254)",
  } as const;

  test("accepts distinct image hashes and theme probes", () => {
    expect(() =>
      assertThemeCapturesDiffer(
        [
          { ...base, theme: "light" },
          {
            ...base,
            theme: "dark",
            sha256: "dark-hash",
            themeProbe: "rgb(3, 8, 10)",
          },
        ],
        "chart"
      )
    ).not.toThrow();
  });

  const failureCases: readonly (readonly [
    string,
    readonly Pick<CaptureRecord, "asset" | "theme" | "sha256" | "themeProbe">[],
  ])[] = [
    ["missing light record", [{ ...base, theme: "dark" }]],
    ["missing dark record", [{ ...base, theme: "light" }]],
    [
      "identical image hashes",
      [
        { ...base, theme: "light" },
        { ...base, theme: "dark", themeProbe: "rgb(3, 8, 10)" },
      ],
    ],
    [
      "identical theme probes",
      [
        { ...base, theme: "light" },
        { ...base, theme: "dark", sha256: "dark-hash" },
      ],
    ],
  ];

  test.each(failureCases)("rejects %s", (_description, records) => {
    expect(() => assertThemeCapturesDiffer(records, "chart")).toThrow(
      "Theme assertion failed for chart"
    );
  });
});

function assertStringArray(value: unknown): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item): item is string => typeof item === "string")
  ) {
    throw new Error("Example manifest must contain HTML filenames");
  }
}
