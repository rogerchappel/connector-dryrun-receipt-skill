# Connector Dry-Run Receipt Skill PRD

## Problem

Agents often finish complex runs with scattered evidence. Reviewers need a compact artifact that shows what the agent intended, what it checked, and which risks remain.

## Goals

- Provide a local CLI and library API.
- Validate required safety fields.
- Render Markdown and JSON for downstream reports.
- Ship fixture-backed tests and a smoke command.

## Non-goals

- External writes.
- Credential storage.
- Replacing human approval.

## Acceptance criteria

- npm test passes.
- npm run check passes.
- npm run smoke renders the valid fixture.
