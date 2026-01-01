# copy-docs CLI

Clone and sync documentation repositories to `~/.local/repos` for local reference.

## Usage

```bash
copy-docs <url>       # Clone repo (or pull if already exists)
copy-docs --sync-all  # Pull all repos in ~/.local/repos
```

## Requirements

### CLI Interface (effect/cli)

- **Single URL argument**: `copy-docs https://github.com/Effect-TS/effect`
- **Sync all flag**: `copy-docs --sync-all` (no URL required)
- **No URL validation**: Pass directly to git, let git handle invalid URLs

### Clone Behavior

- **Target directory**: `~/.local/repos/{org}/{repo}` (preserves org/repo structure)
- **Shallow clone**: Use `--depth 1` by default for speed/disk savings
- **If repo exists**: Auto-pull instead of failing (no separate pull command needed)

### Sync All Behavior

- **Discovery**: Scan `~/.local/repos` for any git repositories
- **Parallelism**: Run pulls in parallel for speed
- **Output**: Buffer output, show clean summary at end
- **Error handling**: Continue on failures, collect errors, show summary at end

### Output

- **Verbose by default**: Show progress, cloning status, success messages
- **Error summary**: On `--sync-all`, list any repos that failed to pull

## Technical Notes

- Build with `effect/cli` for typed CLI parsing
- Use `git clone --depth 1` for shallow clones
- Use `git pull` for updates (standard pull, may fail with local changes)
- Run parallel pulls with `Effect.all` with concurrency
