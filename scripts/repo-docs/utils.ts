import { Option } from "effect";

export type RepoParts = {
  readonly org: string;
  readonly repo: string;
};

export type CommandOutput = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export const stripGitSuffix = (value: string): string =>
  value.endsWith(".git") ? value.slice(0, -4) : value;

export const extractPath = (raw: string): string => {
  if (raw.includes("://")) {
    try {
      return new URL(raw).pathname;
    } catch {
      return raw;
    }
  }
  const colonIndex = raw.indexOf(":");
  if (colonIndex > -1 && !raw.slice(0, colonIndex).includes("/")) {
    return raw.slice(colonIndex + 1);
  }
  return raw;
};

export const parseRepoParts = (raw: string): Option.Option<RepoParts> => {
  const pathPart = extractPath(raw);
  const segments = pathPart.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return Option.none();
  }
  const repo = stripGitSuffix(segments.at(-1) ?? "");
  const org = segments.at(-2) ?? "";
  if (repo.length === 0 || org.length === 0) {
    return Option.none();
  }
  return Option.some({ org, repo });
};

export const formatOutput = (result: CommandOutput): string => {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (stdout.length === 0 && stderr.length === 0) {
    return "";
  }
  if (stdout.length === 0) {
    return stderr;
  }
  if (stderr.length === 0) {
    return stdout;
  }
  return `${stdout}\n${stderr}`;
};

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
