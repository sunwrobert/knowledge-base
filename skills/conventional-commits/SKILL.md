---
name: conventional-commits
description: Write conventional commit messages. Use when committing changes, writing commit messages, or reviewing commit history.
---

# Conventional Commits

Format: `type(scope): description`

## Types

| Type | Use when |
|------|----------|
| `feat` | Adding new functionality |
| `fix` | Fixing a bug |
| `refactor` | Restructuring code without changing behavior |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, config, build) |
| `style` | Formatting, whitespace, semicolons |
| `perf` | Performance improvements |
| `ci` | CI/CD changes |
| `build` | Build system or dependencies |

## Rules

- **Lowercase** type and description
- **No period** at end of description
- **Imperative mood**: "add" not "added" or "adds"
- **Scope** is optional: `feat(auth): add login`
- **Body** for details (blank line after subject)
- **Breaking changes**: `feat!:` or `BREAKING CHANGE:` in body

## Examples

```
feat: add user authentication

fix(api): handle null response from server

refactor: extract validation into separate module

docs: update README with setup instructions

chore: bump typescript to 5.7

feat!: change API response format

BREAKING CHANGE: response now returns { data, meta } instead of raw array
```

## Multi-line

```
feat(auth): add OAuth2 support

- Add Google and GitHub providers
- Store tokens in secure cookie
- Add refresh token rotation
```

## What NOT to do

```
# Bad: past tense
Added new feature

# Bad: uppercase
Feat: Add feature

# Bad: period at end
fix: resolve crash.

# Bad: vague
fix: stuff

# Bad: too long (>50 chars in subject)
feat: add a really long description that goes on and on about what was done
```
