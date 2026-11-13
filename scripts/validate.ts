#!/usr/bin/env bun
// Validates skills/, every plugin under plugins/, and the root catalogs.
// Run: bun scripts/validate.ts

import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

type JsonObject = Record<string, unknown>;

const root = resolve(import.meta.dirname, "..");
const skillsDir = join(root, "skills");
const pluginsDir = join(root, "plugins");
const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---/;
const skillLinkPattern = /\]\(\.\.\/([a-z0-9-]+)\/SKILL\.md[)#]/g;
const clientOnlyDirs = [
  ".devin-plugin",
  ".claude-plugin",
  ".cursor-plugin",
  ".codex-plugin",
  "rules",
];
const errors: string[] = [];

const fail = (message: string): void => {
  errors.push(message);
};

const rel = (path: string): string => relative(root, path);

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDir = (path: string): boolean =>
  existsSync(path) && statSync(path).isDirectory();

const str = (object: JsonObject, key: string): string | null => {
  const value = object[key];
  return typeof value === "string" ? value : null;
};

const list = (object: JsonObject, key: string): readonly unknown[] => {
  const value = object[key];
  return Array.isArray(value) ? value : [];
};

const readJson = (path: string): JsonObject | null => {
  if (!existsSync(path)) {
    fail(`${rel(path)}: missing`);
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (isObject(parsed)) {
      return parsed;
    }
    fail(`${rel(path)}: expected a JSON object`);
  } catch {
    fail(`${rel(path)}: invalid JSON`);
  }
  return null;
};

const frontmatterField = (frontmatter: string, key: string): string | null => {
  const match = frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.*)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
};

// A skill is skills/<name>/SKILL.md whose frontmatter name is <name>.
const checkSkill = (name: string): boolean => {
  const path = join(skillsDir, name, "SKILL.md");
  if (!existsSync(path)) {
    fail(`${rel(path)}: missing`);
    return false;
  }
  const frontmatter = readFileSync(path, "utf8").match(frontmatterPattern)?.[1];
  if (frontmatter === undefined) {
    fail(`${rel(path)}: missing YAML frontmatter`);
    return true;
  }
  const declared = frontmatterField(frontmatter, "name");
  if (declared !== name) {
    fail(`${rel(path)}: name "${declared}" != directory "${name}"`);
  }
  if (frontmatterField(frontmatter, "description") === null) {
    fail(`${rel(path)}: frontmatter missing "description"`);
  }
  if (
    frontmatterField(frontmatter, "github-repo") !== null &&
    frontmatterField(frontmatter, "github-pinned") === null
  ) {
    fail(`${rel(path)}: external skill is not pinned`);
  }
  return true;
};

const markdownFiles = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(path);
    }
    return entry.name.endsWith(".md") ? [path] : [];
  });

// Skills a skill links to as ../<name>/SKILL.md, from any of its Markdown.
const linkedSkills = (name: string): readonly string[] =>
  markdownFiles(join(skillsDir, name)).flatMap((path) =>
    [...readFileSync(path, "utf8").matchAll(skillLinkPattern)].flatMap(
      (match) => (match[1] === undefined ? [] : [match[1]])
    )
  );

const checkManifest = (entry: string): void => {
  const label = `plugins/${entry}/plugin.json`;
  const manifest = readJson(join(pluginsDir, entry, "plugin.json"));
  if (manifest === null) {
    return;
  }
  const name = str(manifest, "name");
  if (name !== entry || !kebab.test(entry)) {
    fail(`${label}: name "${name}" must be the kebab-case directory name`);
  }
  for (const key of ["$schema", "version", "description"]) {
    if (str(manifest, key) === null) {
      fail(`${label}: missing "${key}"`);
    }
  }
};

// A plugin lists shared skills as symlinks to ../../../skills/<skill>, and
// is closed: every skill its members link to is also a member.
const checkPlugin = (entry: string, skills: ReadonlySet<string>): void => {
  const dir = join(pluginsDir, entry);
  for (const clientDir of clientOnlyDirs) {
    if (existsSync(join(dir, clientDir))) {
      fail(`plugins/${entry}/${clientDir}: client-specific, not allowed`);
    }
  }
  checkManifest(entry);
  const pluginSkills = join(dir, "skills");
  const members = isDir(pluginSkills) ? readdirSync(pluginSkills) : [];
  if (members.length === 0) {
    fail(`plugins/${entry}/skills: no skills`);
  }
  for (const member of members) {
    const path = join(pluginSkills, member);
    const label = `plugins/${entry}/skills/${member}`;
    if (!lstatSync(path).isSymbolicLink()) {
      fail(`${label}: must be a symlink to ../../../skills/${member}`);
      continue;
    }
    if (
      resolve(dirname(path), readlinkSync(path)) !== join(skillsDir, member)
    ) {
      fail(`${label}: must point to ../../../skills/${member}`);
    }
    if (!skills.has(member)) {
      fail(`${label}: no skills/${member}/SKILL.md`);
      continue;
    }
    for (const linked of linkedSkills(member)) {
      if (!members.includes(linked)) {
        fail(`${label}: links to "${linked}", which is not in the plugin`);
      }
    }
  }
};

const checkCatalogs = (plugins: readonly string[]): void => {
  const devin = readJson(join(root, ".devin-plugin", "plugin.json"));
  const devinPaths = devin
    ? [...list(devin, "requiredPlugins"), ...list(devin, "optionalPlugins")]
        .filter(isObject)
        .map((plugin) => str(plugin, "path"))
    : [];
  const marketplace = readJson(
    join(root, ".claude-plugin", "marketplace.json")
  );
  const marketplaceSources = marketplace
    ? list(marketplace, "plugins")
        .filter(isObject)
        .map((plugin) => str(plugin, "source"))
    : [];
  for (const plugin of plugins) {
    if (!devinPaths.includes(`plugins/${plugin}`)) {
      fail(`.devin-plugin/plugin.json: plugins/${plugin} not listed`);
    }
    if (!marketplaceSources.includes(`./plugins/${plugin}`)) {
      fail(`.claude-plugin/marketplace.json: plugins/${plugin} not listed`);
    }
  }
  for (const path of [...devinPaths, ...marketplaceSources]) {
    if (path === null || !existsSync(join(root, path))) {
      fail(`catalog path "${path}" does not exist`);
    }
  }
};

const skillNames = new Set(
  (isDir(skillsDir) ? readdirSync(skillsDir) : [])
    .filter((name) => isDir(join(skillsDir, name)))
    .filter(checkSkill)
);
const pluginNames = (isDir(pluginsDir) ? readdirSync(pluginsDir) : []).filter(
  (name) => isDir(join(pluginsDir, name))
);
for (const plugin of pluginNames) {
  checkPlugin(plugin, skillNames);
}
checkCatalogs(pluginNames);

// The repo root installs as a plugin, so a root AGENTS.md would become an
// always-on rule in every session.
for (const file of ["AGENTS.md", "CLAUDE.md"]) {
  if (existsSync(join(root, file))) {
    fail(`${file}: not allowed at the repo root, use docs/AGENTS.md`);
  }
}

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
console.log(
  `OK: ${skillNames.size} skill(s), ${pluginNames.length} plugin(s) validated.`
);
