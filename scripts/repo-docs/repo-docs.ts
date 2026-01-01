import { Args, Command, Options } from "@effect/cli";
import * as PlatformCommand from "@effect/platform/Command";
import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Array as Arr, Chunk, Console, Effect, Option, Stream } from "effect";
import {
  type CommandOutput,
  formatOutput,
  parseRepoParts,
  type RepoParts,
  toErrorMessage,
} from "./utils";

type RepoTarget = RepoParts & {
  readonly url: string;
  readonly dir: string;
  readonly label: string;
};

const decodeUtf8 = (chunks: Chunk.Chunk<Uint8Array>) => {
  const decoder = new TextDecoder();
  const pieces = Chunk.toArray(chunks);
  const text = pieces
    .map((chunk) => decoder.decode(chunk, { stream: true }))
    .join("");
  return text + decoder.decode();
};

const runCommand = (command: PlatformCommand.Command) =>
  Effect.scoped(
    Effect.gen(function* () {
      const process = yield* PlatformCommand.start(command);
      const [stdoutChunks, stderrChunks] = yield* Effect.all(
        [Stream.runCollect(process.stdout), Stream.runCollect(process.stderr)],
        { concurrency: "unbounded" }
      );
      const exitCode = yield* process.exitCode;
      return {
        exitCode,
        stdout: decodeUtf8(stdoutChunks),
        stderr: decodeUtf8(stderrChunks),
      };
    })
  );

const makeGitCommand = (args: readonly string[], cwd?: string) => {
  const command = PlatformCommand.make("git", ...args);
  return cwd ? PlatformCommand.workingDirectory(command, cwd) : command;
};

const runGit = (args: readonly string[], cwd?: string) =>
  runCommand(makeGitCommand(args, cwd));

const baseDir = Effect.gen(function* () {
  const path = yield* Path.Path;
  const home = process.env.HOME;
  if (!home) {
    return yield* Effect.fail(
      new Error("HOME is not set; cannot resolve ~/.local/repos")
    );
  }
  return path.join(home, ".local", "repos");
});

const resolveTarget = (
  url: string
): Effect.Effect<RepoTarget, Error, Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const base = yield* baseDir;
    const parts = parseRepoParts(url);
    if (Option.isNone(parts)) {
      return yield* Effect.fail(
        new Error(`Could not derive org/repo from URL: ${url}`)
      );
    }
    const { org, repo } = parts.value;
    return {
      url,
      org,
      repo,
      dir: path.join(base, org, repo),
      label: `${org}/${repo}`,
    };
  });

const pullRepo = (repoDir: string) => runGit(["pull"], repoDir);

const cloneRepo = (target: { readonly url: string; readonly dir: string }) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory(path.dirname(target.dir), { recursive: true });
    return yield* runGit(["clone", "--depth", "1", target.url, target.dir]);
  });

const logResultOutput = (result: CommandOutput) => {
  const output = formatOutput(result);
  if (output.length === 0) {
    return Effect.void;
  }
  return result.exitCode === 0 ? Console.log(output) : Console.error(output);
};

const handleGitResult = (
  result: CommandOutput,
  label: string,
  operation: string
) =>
  Effect.gen(function* () {
    yield* logResultOutput(result);
    if (result.exitCode === 0) {
      yield* Console.log(`OK ${label}`);
      return;
    }
    return yield* Effect.fail(
      new Error(`git ${operation} failed for ${label}`)
    );
  });

const syncExistingRepo = (target: RepoTarget) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const gitDir = path.join(target.dir, ".git");
    const isGit = yield* fs.exists(gitDir);
    if (!isGit) {
      return yield* Effect.fail(
        new Error(`Target exists but is not a git repo: ${target.dir}`)
      );
    }
    yield* Console.log(`Pulling ${target.label}`);
    const result = yield* pullRepo(target.dir);
    return yield* handleGitResult(result, target.label, "pull");
  });

const cloneNewRepo = (target: RepoTarget) =>
  Effect.gen(function* () {
    yield* Console.log(`Cloning ${target.label}`);
    const result = yield* cloneRepo(target);
    return yield* handleGitResult(result, target.label, "clone");
  });

const syncSingle = (url: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const target = yield* resolveTarget(url);
    const exists = yield* fs.exists(target.dir);
    return yield* exists ? syncExistingRepo(target) : cloneNewRepo(target);
  });

const pullWithSummary = (base: string, repoDir: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const label = path.relative(base, repoDir);
    const result = yield* pullRepo(repoDir).pipe(
      Effect.catchAll((error) =>
        Effect.succeed({
          exitCode: 1,
          stdout: "",
          stderr: toErrorMessage(error),
        })
      )
    );
    return {
      repoDir,
      label,
      ok: result.exitCode === 0,
      output: formatOutput(result),
      exitCode: result.exitCode,
    };
  });

const findGitRepos = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const exists = yield* fs.exists(root);
    if (!exists) {
      return [];
    }
    const entries = yield* fs.readDirectory(root, { recursive: true });
    const gitDirs = entries.filter((entry) => path.basename(entry) === ".git");
    const repoDirs = gitDirs.map((entry) => {
      const resolved = path.isAbsolute(entry) ? entry : path.join(root, entry);
      return path.dirname(resolved);
    });
    return Arr.dedupe(repoDirs);
  });

const syncAllRepos = Effect.gen(function* () {
  const base = yield* baseDir;
  const repos = yield* findGitRepos(base);
  if (repos.length === 0) {
    yield* Console.log(`No repos found in ${base}`);
    return;
  }

  yield* Console.log(`Syncing ${repos.length} repos...`);
  const results = yield* Effect.forEach(
    repos,
    (repoDir) => pullWithSummary(base, repoDir),
    { concurrency: 4 }
  );

  const successes = results.filter((result) => result.ok);
  const failures = results.filter((result) => !result.ok);

  yield* Console.log(
    `Done. ${successes.length} ok, ${failures.length} failed.`
  );

  const summaryLines = results.map(
    (result) => `${result.ok ? "OK" : "FAIL"} ${result.label}`
  );
  yield* Effect.forEach(summaryLines, (line) => Console.log(line));

  if (failures.length > 0) {
    yield* Console.log("Failures:");
    yield* Effect.forEach(failures, (failure) =>
      Console.log(
        failure.output.length > 0
          ? `${failure.label}\n${failure.output}`
          : `${failure.label} (no output)`
      )
    );
  }
});

const url = Args.text({ name: "url" }).pipe(Args.optional);
const syncAllFlag = Options.boolean("sync-all");

const repoDocs = Command.make(
  "repo-docs",
  { url, syncAll: syncAllFlag },
  ({ url, syncAll }) =>
    syncAll
      ? syncAllRepos
      : Option.match(url, {
          onNone: () =>
            Effect.fail(new Error("Provide a repo URL or use --sync-all")),
          onSome: (value) => syncSingle(value),
        })
);

const cli = Command.run(repoDocs, {
  name: "repo-docs",
  version: "0.1.0",
});

cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
