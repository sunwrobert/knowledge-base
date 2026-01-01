import { Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  extractPath,
  formatOutput,
  parseRepoParts,
  stripGitSuffix,
  toErrorMessage,
} from "./utils";

describe("stripGitSuffix", () => {
  it("removes .git suffix", () => {
    expect(stripGitSuffix("repo.git")).toBe("repo");
  });

  it("leaves strings without .git unchanged", () => {
    expect(stripGitSuffix("repo")).toBe("repo");
  });

  it("handles empty string", () => {
    expect(stripGitSuffix("")).toBe("");
  });

  it("only removes suffix, not middle occurrences", () => {
    expect(stripGitSuffix(".git.git")).toBe(".git");
  });
});

describe("extractPath", () => {
  it("extracts pathname from HTTPS URLs", () => {
    expect(extractPath("https://github.com/org/repo")).toBe("/org/repo");
  });

  it("extracts pathname from HTTPS URLs with .git", () => {
    expect(extractPath("https://github.com/org/repo.git")).toBe(
      "/org/repo.git"
    );
  });

  it("extracts path from SSH format", () => {
    expect(extractPath("git@github.com:org/repo.git")).toBe("org/repo.git");
  });

  it("returns raw string for plain paths", () => {
    expect(extractPath("/org/repo")).toBe("/org/repo");
  });

  it("handles invalid URLs gracefully", () => {
    expect(extractPath("not://valid::url")).toBe("not://valid::url");
  });
});

describe("parseRepoParts", () => {
  it("parses HTTPS GitHub URL", () => {
    const result = parseRepoParts("https://github.com/Effect-TS/effect");
    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value).toEqual({ org: "Effect-TS", repo: "effect" });
    }
  });

  it("parses HTTPS GitHub URL with .git suffix", () => {
    const result = parseRepoParts("https://github.com/Effect-TS/effect.git");
    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value).toEqual({ org: "Effect-TS", repo: "effect" });
    }
  });

  it("parses SSH GitHub URL", () => {
    const result = parseRepoParts("git@github.com:Effect-TS/effect.git");
    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value).toEqual({ org: "Effect-TS", repo: "effect" });
    }
  });

  it("parses GitLab URL", () => {
    const result = parseRepoParts("https://gitlab.com/myorg/myrepo");
    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value).toEqual({ org: "myorg", repo: "myrepo" });
    }
  });

  it("returns None for invalid URLs", () => {
    expect(Option.isNone(parseRepoParts(""))).toBe(true);
    expect(Option.isNone(parseRepoParts("invalid"))).toBe(true);
    expect(Option.isNone(parseRepoParts("/"))).toBe(true);
  });

  it("returns None for single segment paths", () => {
    expect(Option.isNone(parseRepoParts("/repo"))).toBe(true);
  });
});

describe("formatOutput", () => {
  it("returns empty string when both stdout and stderr are empty", () => {
    expect(formatOutput({ exitCode: 0, stdout: "", stderr: "" })).toBe("");
  });

  it("returns empty string when both stdout and stderr are whitespace", () => {
    expect(formatOutput({ exitCode: 0, stdout: "  ", stderr: "\n" })).toBe("");
  });

  it("returns stderr when stdout is empty", () => {
    expect(formatOutput({ exitCode: 1, stdout: "", stderr: "error" })).toBe(
      "error"
    );
  });

  it("returns stdout when stderr is empty", () => {
    expect(formatOutput({ exitCode: 0, stdout: "output", stderr: "" })).toBe(
      "output"
    );
  });

  it("combines stdout and stderr with newline", () => {
    expect(
      formatOutput({ exitCode: 0, stdout: "output", stderr: "warning" })
    ).toBe("output\nwarning");
  });

  it("trims whitespace from output", () => {
    expect(
      formatOutput({ exitCode: 0, stdout: "  output  ", stderr: "  warn  " })
    ).toBe("output\nwarn");
  });
});

describe("toErrorMessage", () => {
  it("extracts message from Error objects", () => {
    expect(toErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("converts non-Error values to string", () => {
    expect(toErrorMessage("string error")).toBe("string error");
    expect(toErrorMessage(123)).toBe("123");
    expect(toErrorMessage(null)).toBe("null");
    expect(toErrorMessage(undefined)).toBe("undefined");
  });
});
