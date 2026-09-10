---
name: thermo-nuclear-review-fix-loop
description: Run a persistent thermo-nuclear code-quality review and repair loop. Use when Codex must review current changes, fix every actionable maintainability finding, and repeat complete review passes until a fresh pass returns no findings.
---

# Thermo-Nuclear Review Fix Loop

1. Create a goal to run `$thermo-nuclear-code-quality-review` on the scoped changes, fix every actionable finding, repeat full reviews until clean, and complete the required verification. If an active goal already covers this exact objective, continue it instead of creating a duplicate.
2. Load and apply `$thermo-nuclear-code-quality-review` in full. Review the entire current diff and relevant surrounding code, not only the last files changed.
3. Fix every actionable finding while preserving unrelated work and behavior. Run the relevant scoped tests and repository-required verification after each fix pass.
4. Run another complete thermo-nuclear review from the updated state. Do not limit subsequent passes to checking whether earlier findings were fixed.
5. Repeat review, fix, and verification passes until a complete fresh review returns zero actionable findings. Do not stop merely because one pass was completed or because no new findings appeared while old findings remain.
6. When the review is clean and verification passes, mark the goal complete. Report the number of review passes, the findings fixed, and the verification performed.

If progress genuinely requires user input or new authority, report the exact blocker without claiming the loop is complete.
