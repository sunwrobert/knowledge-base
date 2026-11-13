# solar-mode on Devin

Read only when running on Devin. These triggers add to the ones in [SKILL.md](../SKILL.md).

- Session started by an automation (its prompt names the loop's skill) → once the run picks its target, rename the session to `<loop name>: <target>`, e.g. `Throw → Result: billing/credits.ts parse errors`; a run that finds nothing becomes `<loop name>: no finding`.
