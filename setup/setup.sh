#!/usr/bin/env bash
# One-stop setup for a new Mac. Safe to run again.
set -euo pipefail

SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SETUP_DIR")"
DOTFILES="$SETUP_DIR/dotfiles"
NODE_VERSION="24"

step() { printf '\n==> %s\n' "$1"; }

# Symlink $1 to $2, moving any existing real file aside first.
link() {
  local source="$1" target="$2"
  mkdir -p "$(dirname "$target")"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    mv "$target" "$target.backup.$(date +%Y%m%d%H%M%S)"
  fi
  ln -sfn "$source" "$target"
  echo "linked $target"
}

if [ "$(uname)" != "Darwin" ]; then
  echo "This script only supports macOS." >&2
  exit 1
fi

step "Xcode command line tools"
if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install
  echo "Finish the installer, then run this script again."
  exit 0
fi

step "Homebrew"
if ! command -v brew >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/brew ]; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

step "Apps and command line tools"
brew bundle --file "$SETUP_DIR/Brewfile"

step "Oh My Zsh"
ZSH_DIR="$HOME/.oh-my-zsh"
if [ ! -d "$ZSH_DIR" ]; then
  RUNZSH=no CHSH=no KEEP_ZSHRC=yes \
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi
for plugin in zsh-autosuggestions zsh-syntax-highlighting; do
  plugin_dir="$ZSH_DIR/custom/plugins/$plugin"
  [ -d "$plugin_dir" ] ||
    git clone --depth 1 "https://github.com/zsh-users/$plugin" "$plugin_dir"
done

step "Dotfiles"
link "$DOTFILES/zshrc" "$HOME/.zshrc"
link "$DOTFILES/zprofile" "$HOME/.zprofile"
# Included, not linked, so tools that write to ~/.gitconfig leave the repo clean.
git config --global --get-all include.path | grep -qxF "$DOTFILES/gitconfig" ||
  git config --global --add include.path "$DOTFILES/gitconfig"
link "$DOTFILES/herdr/config.toml" "$HOME/.config/herdr/config.toml"
if [ ! -f "$HOME/.zshrc.local" ]; then
  printf '# Secrets and machine-specific settings. Never commit this file.\n' >"$HOME/.zshrc.local"
  chmod 600 "$HOME/.zshrc.local"
  echo "created ~/.zshrc.local"
fi

step "Node"
eval "$(fnm env --shell bash)"
fnm install "$NODE_VERSION"
fnm default "$NODE_VERSION"
fnm use "$NODE_VERSION"

step "Global npm and bun packages"
npm install --global \
  @earendil-works/pi-coding-agent \
  @openai/codex \
  agent-browser \
  executor \
  hunkdiff \
  prime-agent
bun add --global @oh-my-pi/pi-coding-agent

step "Claude Code"
command -v claude >/dev/null 2>&1 || [ -x "$HOME/.local/bin/claude" ] ||
  curl -fsSL https://claude.ai/install.sh | bash

step "Agent skills"
mkdir -p "$HOME/.agents/skills" "$HOME/.claude/skills"
for skill_dir in "$REPO_DIR"/skills/*/; do
  name="$(basename "$skill_dir")"
  [ -e "$HOME/.agents/skills/$name" ] ||
    ln -s "${skill_dir%/}" "$HOME/.agents/skills/$name"
  [ -e "$HOME/.claude/skills/$name" ] ||
    ln -s "../../.agents/skills/$name" "$HOME/.claude/skills/$name"
done

step "Done"
echo "Open a new terminal, then follow the manual steps in setup/README.md."
echo "Or hand setup/AGENT_PROMPT.md to a coding agent to finish and verify."
