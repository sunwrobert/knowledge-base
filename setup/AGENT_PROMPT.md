# Agent Prompt: Set Up This Mac

Paste everything below into a coding agent running on the new machine.

---

Set up this Mac from my knowledge-base repo.

## Steps

1. If `~/Repositories/knowledge-base` does not exist, clone `https://github.com/sunwrobert/knowledge-base.git` there.
2. Read `setup/README.md` and `setup/setup.sh` before running anything.
3. Run `setup/setup.sh`. If it stops for the Xcode command line tools installer, wait for me to finish it, then run the script again.
4. If a step fails, find the cause, fix it and run the script again. It is safe to run more than once. If a Homebrew cask no longer exists, tell me instead of substituting another one.
5. Verify the result:
   - `brew bundle check --file setup/Brewfile` passes.
   - `git`, `gh`, `gt`, `bun`, `pnpm`, `node`, `uv`, `tilt`, `tofu`, `infisical`, `pi`, `codex`, `claude`, `omp` and `agent-browser` all resolve in a new login shell (`zsh -lic 'command -v <name>'`).
   - `~/.zshrc`, `~/.zprofile`, `~/.config/zed/settings.json` and `~/.config/herdr/config.toml` are symlinks into `setup/dotfiles`.
   - `git config --global --get-all include.path` lists `setup/dotfiles/gitconfig`.
   - `~/.agents/skills` contains the skills from the repo.
6. Report what was installed, what failed, and the manual steps from `setup/README.md` that are still open.

## Rules

- Never write a secret, API key or token to any file in the repo. Secrets go in `~/.zshrc.local` only, and I enter them myself.
- Do not log in to any account for me. List the login commands I need to run.
- Do not install or remove employer-managed software such as device management, security or compliance agents.
- Do not commit or push changes to the repo unless I ask.
- Do not delete the `.backup.<timestamp>` files the script creates.
