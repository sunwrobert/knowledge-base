#!/usr/bin/env bun
// Renders a code spotlight: an editor-style 2x PNG of one or more line ranges of a file at a
// git ref, with optional removed/added overlay from a diff, highlighted lines, boxed tokens,
// breadcrumbs and a caption. Run: bun render.ts --help

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { codeToTokens, type BundledLanguage, type BundledTheme } from "shiki";

type LineKind = "ctx" | "add" | "del" | "gap";
type Line = { n: number | null; text: string; kind: LineKind };
type Range = { from: number; to: number };
type Args = {
  repo: string;
  file: string;
  ref: string;
  lines: Range[];
  diff: string | null;
  crumbs: string[];
  highlight: Set<number>;
  mark: string[];
  caption: string | null;
  out: string;
  theme: BundledTheme;
  width: number;
  dedent: boolean;
};

const HELP = `Usage: bun render.ts --file <path> --lines <a-b[,c-d]> [options]

  --file <path>         file path relative to --repo
  --lines <a-b,c-d>     line ranges in the file at --ref (new side when --diff is set)
  --repo <dir>          git checkout to read from (default: cwd)
  --ref <rev>           git revision to read the file at (default: working tree)
  --diff <base>         overlay removed lines from \`git diff <base> <ref> -- file\` and
                        mark added lines inside the chosen ranges
  --github <url>        shorthand for --file/--lines/--ref from a github.com blob URL with #Lx-Ly
  --crumbs "a > b"      symbol breadcrumbs shown after the file path
  --highlight <n,n>     line numbers to tint (new side)
  --mark <token,token>  tokens to box wherever they appear
  --caption "Label|text" caption bar under the code (label is bolded)
  --out <file.png>      output path (default: ./spotlight-<file>-<lines>.png)
  --theme <shiki theme> default dark-plus (VS Code Dark Modern colours)
  --width <px>          CSS width, default 1000 (PNG is 2x)
  --dedent              strip the shared leading indent
`;

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--"))
      throw new Error(`${flag} needs a value`);
    return v;
  };
  if (argv.includes("--help") || argv.length === 0) {
    console.log(HELP);
    process.exit(0);
  }
  let file = get("--file");
  let lines = get("--lines");
  let ref = get("--ref") ?? "";
  const github = get("--github");
  if (github) {
    const m =
      /github\.com\/[^/]+\/[^/]+\/blob\/([^/]+)\/([^#]+)(?:#L(\d+)(?:-L(\d+))?)?/.exec(
        github
      );
    if (!m) throw new Error(`cannot parse GitHub blob URL: ${github}`);
    ref = ref || m[1]!;
    file = file ?? decodeURIComponent(m[2]!);
    if (!lines && m[3]) lines = `${m[3]}-${m[4] ?? m[3]}`;
  }
  if (!file) throw new Error("--file (or --github) is required");
  if (!lines) throw new Error("--lines (or #L in --github) is required");
  const ranges = lines.split(",").map((r): Range => {
    const [a, b] = r.split("-").map((x) => Number.parseInt(x, 10));
    if (!a || Number.isNaN(a)) throw new Error(`bad range: ${r}`);
    return { from: a, to: b && !Number.isNaN(b) ? b : a };
  });
  const slug = `${basename(file, extname(file))}-${ranges.map((r) => `${r.from}-${r.to}`).join("_")}`;
  return {
    repo: resolve(get("--repo") ?? process.cwd()),
    file,
    ref,
    lines: ranges,
    diff: get("--diff"),
    crumbs: (get("--crumbs") ?? "")
      .split(">")
      .map((s) => s.trim())
      .filter(Boolean),
    highlight: new Set(
      (get("--highlight") ?? "").split(",").filter(Boolean).map(Number)
    ),
    mark: (get("--mark") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    caption: get("--caption"),
    out: resolve(get("--out") ?? `spotlight-${slug}.png`),
    theme: (get("--theme") ?? "dark-plus") as BundledTheme,
    width: Number(get("--width") ?? 1000),
    dedent: argv.includes("--dedent"),
  };
}

function git(repo: string, args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readFileLines(a: Args): string[] {
  const text = a.ref
    ? git(a.repo, ["show", `${a.ref}:${a.file}`])
    : readFileSync(join(a.repo, a.file), "utf8");
  return text.replace(/\n$/, "").split("\n");
}

type DiffInfo = { added: Set<number>; removedBefore: Map<number, string[]> };

// Parses a unified diff of one file. `added` holds new-side line numbers of + lines;
// `removedBefore` maps a new-side line number to the - lines that sat directly before it.
function parseDiff(a: Args): DiffInfo {
  const out = git(
    a.repo,
    ["diff", "--no-color", "-U0", a.diff!, a.ref || "", "--", a.file].filter(
      Boolean
    )
  );
  const added = new Set<number>();
  const removedBefore = new Map<number, string[]>();
  let newLine = 0;
  let pending: string[] = [];
  const flush = (): void => {
    if (pending.length === 0) return;
    removedBefore.set(newLine, [
      ...(removedBefore.get(newLine) ?? []),
      ...pending,
    ]);
    pending = [];
  };
  for (const raw of out.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      flush();
      newLine = Number(hunk[1]);
      continue;
    }
    if (
      raw.startsWith("+++") ||
      raw.startsWith("---") ||
      raw.startsWith("diff ") ||
      raw.startsWith("index ")
    )
      continue;
    if (raw.startsWith("-")) {
      pending.push(raw.slice(1));
      continue;
    }
    if (raw.startsWith("+")) {
      flush();
      added.add(newLine);
      newLine += 1;
      continue;
    }
    if (raw.startsWith(" ")) {
      flush();
      newLine += 1;
    }
  }
  flush();
  return { added, removedBefore };
}

function buildLines(a: Args, source: string[], diff: DiffInfo | null): Line[] {
  const lines: Line[] = [];
  a.lines.forEach((range, i) => {
    if (i > 0) lines.push({ n: null, text: "", kind: "gap" });
    for (let n = range.from; n <= range.to && n <= source.length; n += 1) {
      for (const text of diff?.removedBefore.get(n) ?? [])
        lines.push({ n: null, text, kind: "del" });
      lines.push({
        n,
        text: source[n - 1]!,
        kind: diff?.added.has(n) ? "add" : "ctx",
      });
    }
    const tail = diff?.removedBefore.get(range.to + 1) ?? [];
    if (range.to === source.length)
      for (const text of tail) lines.push({ n: null, text, kind: "del" });
  });
  if (a.dedent) {
    const indents = lines
      .filter((l) => l.kind !== "gap" && l.text.trim())
      .map((l) => /^ */.exec(l.text)![0].length);
    const shared = Math.min(...indents);
    if (Number.isFinite(shared) && shared > 0)
      for (const l of lines) l.text = l.text.slice(shared);
  }
  return lines;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LANG_BY_EXT: Record<string, BundledLanguage> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".md": "markdown",
  ".mdx": "mdx",
  ".sql": "sql",
  ".css": "css",
  ".html": "html",
  ".tf": "hcl",
  ".hcl": "hcl",
  ".rb": "ruby",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".proto": "proto",
};

async function toHtml(
  a: Args,
  lines: Line[]
): Promise<{ html: string; height: number }> {
  const lang = LANG_BY_EXT[extname(a.file)] ?? "text";
  const code = lines.map((l) => (l.kind === "gap" ? "" : l.text)).join("\n");
  const { tokens, bg, fg } = await codeToTokens(code, { lang, theme: a.theme });
  const markRe = a.mark.length
    ? new RegExp(`(${a.mark.map(escRe).join("|")})`, "g")
    : null;
  const indentW = 2;
  const rows = lines.map((l, i) => {
    if (l.kind === "gap")
      return `<div class="row gap"><span class="ln">⋯</span><span class="sign"> </span><span class="code"></span></div>`;
    const indent = /^ */.exec(l.text)![0].length;
    const guides = Array.from(
      { length: Math.floor(indent / indentW) },
      (_, g) => `<span class="guide" style="left:${g * indentW}ch"></span>`
    ).join("");
    const html = (tokens[i] ?? [])
      .map((t) => {
        const txt = markRe
          ? esc(t.content).replace(markRe, '<span class="mark">$1</span>')
          : esc(t.content);
        return `<span style="color:${t.color ?? fg}">${txt}</span>`;
      })
      .join("");
    const cls = [
      "row",
      l.kind,
      l.n !== null && a.highlight.has(l.n) ? "hl" : "",
    ].join(" ");
    const sign = l.kind === "add" ? "+" : l.kind === "del" ? "−" : " ";
    return `<div class="${cls}"><span class="ln">${l.n ?? ""}</span><span class="sign">${sign}</span><span class="code">${guides}${html}</span></div>`;
  });
  const crumbs = [a.file, ...a.crumbs]
    .map(
      (c, i) =>
        `${i ? '<span class="sep">›</span>' : ""}<span class="${i ? "sym" : "file"}">${esc(c)}</span>`
    )
    .join("");
  const [capLabel, capText] = a.caption
    ? a.caption.split("|", 2)
    : [null, null];
  const lh = 26,
    pad = 22,
    head = 44,
    cap = a.caption ? 44 : 0,
    frame = 8;
  const height = head + pad * 2 + lines.length * lh + cap + frame * 2;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#0b0c10}
  .frame{width:${a.width}px;height:${height}px;box-sizing:border-box;padding:${frame}px;background:#0b0c10}
  .win{background:${bg};color:${fg};border:1px solid #2b2b2b;border-radius:10px;overflow:hidden;font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace;font-size:14.5px;line-height:${lh}px;height:${height - frame * 2}px;box-sizing:border-box;display:flex;flex-direction:column}
  .head{height:${head}px;flex:none;display:flex;align-items:center;gap:8px;padding:0 18px;background:#181818;border-bottom:1px solid #2b2b2b;font-size:13px;color:#9d9d9d;white-space:nowrap;overflow:hidden}
  .head .file{color:#cccccc}.head .sym{color:#9d9d9d}.head .sep{color:#5a5a5a;padding:0 2px}
  .body{padding:${pad}px 0;flex:1}
  .row{display:flex;height:${lh}px;position:relative;white-space:pre}
  .ln{width:56px;text-align:right;padding-right:14px;color:#6e7681;flex:none}
  .sign{width:18px;color:transparent;flex:none}
  .code{position:relative;flex:1;padding-right:24px;overflow:hidden}
  .guide{position:absolute;top:0;bottom:0;border-left:1px solid #404040;margin-left:.5px}
  .row.hl{background:rgba(255,255,255,.07)}.row.hl .ln{color:#cccccc}
  .row.add{background:rgba(63,185,80,.16)}.row.add .sign,.row.add .ln{color:#3fb950}
  .row.del{background:rgba(248,81,73,.15)}.row.del .sign,.row.del .ln{color:#f85149}.row.del .code{opacity:.62}
  .row.gap .ln{color:#4a4a4a}
  .mark{outline:1.5px solid #e2c08d;outline-offset:1px;border-radius:3px;background:rgba(226,192,141,.08)}
  .cap{height:${cap}px;flex:none;display:flex;align-items:center;padding:0 18px;background:#181818;border-top:1px solid #2b2b2b;font-family:Inter,system-ui,sans-serif;font-size:13px;color:#b4b4b4;white-space:nowrap;overflow:hidden}
  .cap b{color:#e2c08d;font-weight:600;margin-right:8px}
  </style></head><body><div class="frame"><div class="win"><div class="head">${crumbs}</div><div class="body">${rows.join("")}</div>${
    a.caption
      ? `<div class="cap"><b>${esc(capLabel ?? "")}</b>${esc(capText ?? "")}</div>`
      : ""
  }</div></div></body></html>`;
  return { html, height };
}

function findChrome(): string {
  const candidates = [
    process.env.CHROME,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter((c): c is string => Boolean(c));
  for (const c of candidates) {
    const r = spawnSync("which", [c], { encoding: "utf8" });
    if (r.status === 0) return r.stdout.trim();
  }
  throw new Error("no Chrome/Chromium on PATH; set CHROME=/path/to/chrome");
}

function screenshot(
  html: string,
  width: number,
  height: number,
  out: string
): void {
  const dir = mkdtempSync(join(tmpdir(), "spotlight-"));
  const htmlPath = join(dir, "spot.html");
  writeFileSync(htmlPath, html);
  // headless Chrome's --window-size includes window chrome, so render tall and crop.
  const r = spawnSync(
    findChrome(),
    [
      "--headless=new",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      `--window-size=${width},${height + 200}`,
      `--screenshot=${out}`,
      `file://${htmlPath}`,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0 || !existsSync(out))
    throw new Error(`chrome screenshot failed: ${r.stderr}`);
  const crop = spawnSync(
    "convert",
    [out, "-crop", `${width * 2}x${height * 2}+0+0`, "+repage", out],
    { encoding: "utf8" }
  );
  if (crop.status !== 0)
    console.warn(
      "ImageMagick `convert` not available; PNG keeps blank padding below the frame"
    );
}

const args = parseArgs(process.argv.slice(2));
const source = readFileLines(args);
const diff = args.diff ? parseDiff(args) : null;
const lines = buildLines(args, source, diff);
const { html, height } = await toHtml(args, lines);
screenshot(html, args.width, height, args.out);
console.log(args.out);
