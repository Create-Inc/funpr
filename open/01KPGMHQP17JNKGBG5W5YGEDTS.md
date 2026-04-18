---
version: 1
id: 01KPGMHQP17JNKGBG5W5YGEDTS
status: open
labels:
  - spec
scope:
  ref: f0954c9b6a7f91835e1f60ac15fb0317e9fe0326
  paths: []
created_by:
  user: unknown
created_at: 2026-04-18T15:50:00.640Z
updated_at: 2026-04-18T15:50:00.640Z
---

# slop-team-config

# Slop Team Config Initialization\n\n## What\nAdds a  configuration file to the repository root to enable slop team mode for the project. This file defines the validation strategy, setup command, and spec storage method used by the slop factory.\n\n## Why\nThe slop team config is required to onboard the repository into the slop factory workflow, enabling automated spec-driven development and team coordination.\n\n## Category\nConfiguration / DevOps\n\n## Design Reference\nN/A — configuration-only change with no UI impact.\n\n## Details\nThe PR adds a single file  at the repository root with the following configuration:\n\n- **version**:  — schema version for the slop config format.\n- **validation.strategy**:  — indicates that feature verification uses browser-based preview.\n- **validation.previewUrlPattern**:  — no preview URL pattern is configured yet (placeholder).\n- **setupCommand**:  — the command to run for project setup/dependency installation.\n- **specStore**: Usage: git-track <command> [options]

Commands:
  install [--no-push]     Set up git-track in the current repo
  init                    Initialize the git-track branch
  assign <id>             Assign an issue
  create                  Create a new issue
  list                    List issues
  show <id>               Show an issue
  comment <id>            Add a comment to an issue
  close <id>              Close an issue
  link <id>               Link a PR to an issue
  sweep                   Close issues with merged PRs
  query                   Query issues by path
  search <term>           Search issues by summary keyword
  skill                   Print the current skill file
  sync                    Fetch latest from remote
  update                  Update the skill file
  ui                      Open the local web UI

Flags:
  --help, -h              Show help for a command
  --offline               Skip fetch/push (auto-detected when no remote)

Environment:
  GIT_TRACK_OFFLINE=1     Same as --offline — specs are stored and tracked via git.\n\nNo other files are modified. This is a zero-impact configuration addition that does not affect application behavior.\n\n## External Dependencies\nNone\n\n## Constraints\n- This is an adopted PR (#2, branch ).\n- The  is set to , meaning browser-preview validation won't have a functional URL pattern until updated in a future change.\n- The config uses slop schema version 1.\n\n## Boundaries\n- Does not modify any application code, tests, or dependencies.\n- Does not provision any external services or CI pipelines.\n- Does not define any specs — it only enables the infrastructure for spec-driven workflows.\n\n## Verification\n1. Confirm  exists at the repository root.\n2. Verify the file contains valid YAML with keys: , , , and .\n3. Verify  is set to .\n4. Verify  is  and  is .\n5. Verify  is .\n6. Verify  is Usage: git-track <command> [options]

Commands:
  install [--no-push]     Set up git-track in the current repo
  init                    Initialize the git-track branch
  assign <id>             Assign an issue
  create                  Create a new issue
  list                    List issues
  show <id>               Show an issue
  comment <id>            Add a comment to an issue
  close <id>              Close an issue
  link <id>               Link a PR to an issue
  sweep                   Close issues with merged PRs
  query                   Query issues by path
  search <term>           Search issues by summary keyword
  skill                   Print the current skill file
  sync                    Fetch latest from remote
  update                  Update the skill file
  ui                      Open the local web UI

Flags:
  --help, -h              Show help for a command
  --offline               Skip fetch/push (auto-detected when no remote)

Environment:
  GIT_TRACK_OFFLINE=1     Same as --offline.\n\n## Related\nNone\n
