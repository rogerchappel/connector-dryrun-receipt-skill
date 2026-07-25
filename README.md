# Connector Dry-Run Receipt Skill

Local-first skill for rendering connector dry-run plans into reviewable approval receipts.

## Quickstart

```bash
npm test
npm run smoke
node bin/connector-dryrun-receipt.js validate fixtures/receipt.valid.json
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format json
```

`validate` prints deterministic JSON findings and exits with status 1 for an invalid
plan. `render` still prints a reviewable receipt for invalid input, but also exits
with status 1; inspect the output rather than treating a rendered file as a pass.

Each change must declare `risk` as `low`, `medium`, or `high`. Missing or unknown
values are validation errors and are normalized to `high` in rendered receipts so
that `highestRisk` cannot understate uncertainty. Every `approvals[]` and
`rollback[]` entry must be a nonempty string. Findings identify malformed entries
by index, and Markdown uses an explicit invalid-item placeholder instead of
stringifying objects or nulls.

## What it does

- Validates a local JSON fixture before an agent uses it in a handoff or approval flow.
- Renders a Markdown artifact that can be pasted into a PR, issue, Slack thread, or run report.
- Flags missing verification or approval context without calling external services.
- Keeps secret-looking values visible only as validation warnings; it does not transmit data.

## Library API

The package root is an ESM entry point exporting `readPlan`, `validatePlan`,
`buildReceipt`, and `renderMarkdown`.

```js
import {
  buildReceipt,
  readPlan,
  renderMarkdown,
  validatePlan
} from "connector-dryrun-receipt-skill";

const input = readPlan("fixtures/receipt.valid.json");
const validation = validatePlan(input);
const receipt = buildReceipt(input);
const markdown = renderMarkdown(input);
```

## Limitations

This package is local-first. It does not fetch private chat logs, call connectors, store credentials, or approve writes. Treat output as a review aid, not as proof that an external system changed.

## Safety notes

Run against redacted fixtures when possible. Review validation warnings before sharing reports outside the project context.
