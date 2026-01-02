---
name: interview-spec
description: Interview the user about a spec or plan file, asking in-depth questions about technical implementation, UI/UX, concerns, and tradeoffs. Use when refining requirements, planning features, or fleshing out specifications.
---

# Spec Interview

Deep-dive interview process to refine specifications and uncover hidden requirements.

## Process

1. **Read the spec file** provided by the user (e.g., `SPEC.md`, `plan.md`)
2. **Interview continuously** using AskUserQuestion tool until spec is complete
3. **Update the spec file** with all gathered information

## Interview Guidelines

### Ask non-obvious questions

Don't ask surface-level questions. Dig deeper:

- **Bad**: "What should the button do?"
- **Good**: "If the user clicks the button while a background sync is in progress, should we queue the action, cancel the sync, or show a conflict modal?"

### Cover all dimensions

| Area            | Example questions                                                         |
| --------------- | ------------------------------------------------------------------------- |
| **Technical**   | Data flow, state management, error handling, caching, offline behavior    |
| **UI/UX**       | Edge cases, empty states, loading states, error states, accessibility     |
| **Tradeoffs**   | Performance vs simplicity, flexibility vs consistency, build vs buy       |
| **Concerns**    | Security implications, scalability limits, maintenance burden             |
| **Integration** | How it affects existing features, migration path, backwards compatibility |

### Question patterns

- "What happens when X fails?"
- "How should this behave if the user has [edge case]?"
- "What's the expected behavior when [two things conflict]?"
- "Is [assumption] correct, or should we handle [alternative]?"
- "What's more important here: [tradeoff A] or [tradeoff B]?"
- "Have you considered [non-obvious implication]?"

### Keep interviewing until

- All edge cases are addressed
- Error handling is defined
- UI states are specified (loading, empty, error, success)
- Technical constraints are documented
- Tradeoffs are explicitly decided
- User confirms spec is complete

## Output

After interview, update the spec file with:

- Clarified requirements
- Documented decisions
- Edge cases and error handling
- Technical constraints
- Open questions (if any remain)
