# Machine Setup

One script sets up a new Mac: apps, command line tools, shell, dotfiles, Node, global packages and agent skills.

## Run

```bash
git clone https://github.com/sunwrobert/knowledge-base.git ~/Repositories/knowledge-base
~/Repositories/knowledge-base/setup/setup.sh
```

The script is safe to run again. Existing dotfiles are moved to `<name>.backup.<timestamp>` before they are replaced with symlinks into this folder. `~/.gitconfig` is the exception: it stays a real file that includes `dotfiles/gitconfig`.

## Contents

- `Brewfile`: Homebrew formulae and casks.
- `dotfiles/`: `zshrc`, `zprofile`, `gitconfig` and Herdr config.
- `setup.sh`: the setup script.
- `AGENT_PROMPT.md`: a prompt that has a coding agent run and verify the setup.

## Manual Steps

1. Sign in to 1Password and turn on its SSH agent.
2. Run `gh auth login`, `gh auth setup-git`, `gt auth` and `gcloud auth login`.
3. Install the command line tools with no package: `ori`, `herdr`, `fx` and `devin`.
4. Run `ori login`, then `ori alias` so plain `pi`, `claude`, `codex` and `omp` run through Ori. No OpenRouter key goes in the shell config.
5. Install the apps with no Homebrew cask: Devin, Ferry, Hex, Magnet, Ori, PR Review, Grok Bot, Rex Beta and Xcode.
6. Import Raycast settings.
7. Put any other secrets in `~/.zshrc.local`, which the script creates and git never sees.

## Not Included

- Secrets: SSH keys, API keys and auth tokens.
- Apps and agents an employer installs.

## Updating

Add a tool to `Brewfile` or the package list in `setup.sh` when you start using it. Edit dotfiles in place; they are symlinks into this repo.

## With An Agent

Once a coding agent is installed, paste `AGENT_PROMPT.md` into it. The agent runs the script, fixes failures, checks the result and lists the manual steps that are left.
