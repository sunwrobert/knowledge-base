---
name: audit-to-prs
description: >-
  Turn an audit's findings into PRs: one PR per finding reproduced on clean `origin/main`, the rest listed with the evidence each lacks. Use for "/audit-to-prs <report or session>", "make PRs from this audit", or after an audit skill in an automation router.
metadata:
  version: 1.1.0
  disable-model-invocation: true
---

Rate every finding in the audit by severity and confidence. Ship each finding you reproduced on clean `origin/main` as its own PR, on its own branch cut from `origin/main`, worst first. Link the open PR that already fixes a finding instead of opening a second. List every other finding with its rating and the evidence it lacks.
