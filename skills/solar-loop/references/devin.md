# solar-loop on Devin

Read only when creating or revising a Devin automation. Dry-run with `devin_automation_manage` `validate_create` or `validate_update` before the write.

Read the `devin_automation_manage` schemas before writing any field. Fill from this table unless the user overrides a cell. Leave `devin_mode` unset so the run inherits the creator's mode; set it only when the user names one.

| Field                                 | Loop that ships code                                                              | Ops loop                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| trigger                               | `schedule:recurring`, weekday morning in the owner's timezone, non-round minute   | same, or a Slack trigger when it reacts to a channel                    |
| action                                | `start_session`                                                                   | `start_session`                                                         |
| max_acu_limit                         | 60–150 by scope                                                                   | 8–30                                                                    |
| max_concurrent_runs / max_queue_depth | 10 / 0 (climb or audit: 1 / 0)                                                    | 1 / 10                                                                  |
| run_as                                | creator                                                                           | organization when a service identity or org-scoped secret does the work |
| mcp_servers                           | `datadog` when it reads telemetry, `slack-remote` when the prompt pings a channel | only what the prompt uses                                               |
| linear_enabled                        | true when the prompt files tickets                                                | false                                                                   |
| slack_channels grant                  | none                                                                              | the one channel it posts to                                             |
| notifications.slack                   | none; the report is the session response                                          | `post_response` to the channel                                          |
| bypass_approval                       | true when the run spawns child sessions                                           | false                                                                   |
| net_policy                            | null                                                                              | explicit allowlist when run_as is organization                          |
| metadata                              | `{ purpose: <slug> }` or `{ skill: <skill>, team: <team> }`                       | same                                                                    |

- Schedule minutes are never `:00` or `:30`, and no two siblings fire in the same hour. Keep a user-named time exactly. Bound a trial with `UNTIL`.
- Alert, bug and support triage is a Devin Oncall responder, not an automation.
- A loop that ships code reports in the session and requests review per [**review-loop**](../../review-loop/SKILL.md). An ops loop posts exactly one message per run, no-op runs included, with a fixed marker phrase siblings can filter on.
- Add a preflight script only after testing it against the exact event shape on a real VM, and never one that needs a secret.
- Choose `run_as` by where the MCP server and credentials are installed, and name the user-scoped integrations the run depends on.
