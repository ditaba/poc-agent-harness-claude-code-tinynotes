# Codex repository guidance

AGENTS.md is the entry point and explicitly loads rules/project.md and relevant
skills in this directory. These are independent copies, editable for Codex
without changing Claude configuration. SPEC.md remains the shared source of truth.

- rules/project.md: architecture, invariants, commands and Ralph task rules.
- skills/: eight implementation skill guides and their supporting resources.
- workflows/: documentation lookup and code review instructions.

These skills are loaded through AGENTS.md instructions, not automatic discovery.
MCP and sandbox settings for the loop are passed by ralph.sh.
