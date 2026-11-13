---
name: pdd-prove
description: >-
  Check that every rule a change promises is tested from both sides: "never" (the bad case never happens) and "always" (the good case always happens). Adds the missing side as a test and proves each test can fail by planting the bug it guards against. Use for /pdd-prove, "pdd prove", "prove both ways", "both ways", "test both sides", "is this only tested one way", or before calling a gate, filter, auth check, or validator done.
metadata:
  version: 0.1.0
  disable-model-invocation: true
---

# PDD prove

A rule has two sides. Most tests check only one.

- **Never:** the bad case never happens. A wrong password never gets a token.
- **Always:** the good case always happens. The right password always gets a token.

Code that rejects everything passes every "never" test. Code that accepts everything passes every "always" test. Only both sides together pin the rule.

Input: a PR, a diff, a file, or a rule in words. If none is given, use the current branch's diff against `origin/main`.

## Procedure

1. List each rule the change promises, one line each, in the user's words where they exist. Gates, filters, auth checks, validators, rate limits, and fallbacks are the usual sources.
2. For each rule, write its "never" sentence and its "always" sentence. If one side is out of scope on purpose (for example a best-effort filter with no "always" promise), write `n/a (<reason>)` and confirm it with the user.
3. For each sentence, find the test that asserts it. Name the file and test. A test that only checks one side does not cover the other.
4. Write a test for each missing side. Follow [principle-test-behavior-not-implementation](../principle-test-behavior-not-implementation/SKILL.md) and the repo's test rules. Do not edit an existing test to make it cover a side.
5. Prove each side can fail. First run the test on unchanged code and confirm it passes; a test that already fails is a finding (step 6), not proof. Then plant the bug that side guards against, run the test, and keep the output of the assertion that fails for this rule (a setup or import error does not count):
   - For a "never" test, make the code accept everything (return the success value early).
   - For an "always" test, make the code reject everything (return the refusal early).
     Revert the plant and rerun the test to confirm it passes again. A test that still passes with the bug planted does not count for that side. First check the plant sits on the path the test runs; if not, move it. Never delete an existing test: add a focused one instead. Fix or drop only tests you wrote in step 4.
6. If a planted bug shows the current code already breaks a rule, report it as a finding with the input that breaks it. Do not weaken the sentence until it passes.

## Report

One `diff` block per rule, then the outstanding items.

```diff
rule: only a valid image passes the inline-image gate
+ never:  corrupt image is rejected       gate.test.ts › "rejects corrupt jpeg"   fails when gate accepts all
- always: valid image passes              missing → added gate.test.ts › "passes valid png"   fails when gate rejects all
```

A covered side means the named tests catch the accept-all or reject-all bug. It does not mean every input is covered; add property tests when the rule needs that.

`+` marks a side that was already covered. `-` marks a side that was missing, followed by the test you added.

## Forbidden

- Do not count a test that passes with its planted bug, or one that fails without it.
- Do not commit a planted bug.
