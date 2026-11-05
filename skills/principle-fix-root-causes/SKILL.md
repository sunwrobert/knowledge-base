---
description: Apply when debugging. Trace each symptom to its root cause and fix it there; reproduce first, ask why until you reach it, resist nil-check guards that silence crashes.
disable-model-invocation: true
metadata:
    github-path: pstack/skills/principle-fix-root-causes
    github-pinned: ecc249f1e306fc64ddf83c7bed16cacf7c2239db
    github-ref: ecc249f1e306fc64ddf83c7bed16cacf7c2239db
    github-repo: https://github.com/cursor/plugins
    github-tree-sha: 0ec22d21fffd180573f49ea239ee76083d6a6f40
name: principle-fix-root-causes
---
# Fix Root Causes

When debugging, do not fix symptoms. Trace every problem to its root cause and fix it there.

**Why:** Symptom fixes accumulate. Each workaround makes the system harder to reason about, and the real bug remains. Root-cause fixes are slower upfront but reduce total debugging time.

**Pattern:**
- Reproduce first
- Ask "why" until you hit the root cause
- Do not add guards (adding a nil check to silence a crash is a symptom fix)
- If a workaround needs a paragraph-long comment to justify it, the code is wrong (fix the code, not the comment)
- Check for the pattern, not just the instance (grep for the same pattern, fix all instances)
- When stuck, instrument. Don't guess (add logging, read the actual error)

**Restart bugs: suspect state before code**

When something "fails after restart," suspect stale persistent state first: config files, caches, lock files, serialized state. If clearing a state file restores behavior, prioritize state validation as the fix.
