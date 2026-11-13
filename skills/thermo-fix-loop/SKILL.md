---
name: thermo-fix-loop
description: Loop thermo-nuclear code-quality review and fixes until a fresh full pass finds nothing. Use when the agent must review current changes and fix every actionable maintainability finding.
metadata:
  version: 1.1.0
---

# Thermo-nuclear review fix loop

1. Create a goal for this loop, or continue an active one that covers it.
2. Apply `$thermo-nuclear-code-quality-review` in full to the whole current diff and its surrounding code.
3. Fix every actionable finding without changing unrelated behavior, then run scoped tests and the repo's required verification.
4. Re-review the whole updated diff from scratch, not just the earlier findings. Repeat to a fixed point: a fresh full pass with zero actionable findings.
5. Mark the goal complete. Report the pass count, findings fixed, and verification run.

Blocked on user input or new authority: report the exact blocker and leave the loop open.
