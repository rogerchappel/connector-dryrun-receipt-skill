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
Both commands accept `-` to read JSON from stdin. `render` defaults to Markdown;
its only option is one complete `--format markdown|json` pair after the file.
Malformed invocations print a stable `Usage error:` message to stderr and exit
with status 2, distinguishing command-line mistakes from invalid plans.

Each change must declare `risk` as `low`, `medium`, or `high`. Missing or unknown
values are validation errors and are normalized to `high` in rendered receipts so
that `highestRisk` cannot understate uncertainty. A missing, malformed, or empty
`changes` list also renders `highestRisk` as `high`, never `low`. Required receipt
fields (`id`, `connector`, `action`, `target`, and `approvalMode`) must be nonempty
strings; invalid values retain their validation errors and render as explicit
`missing <field>` placeholders in both structured and Markdown output. When present, `approvals` and
`rollback` must be arrays, and every entry must be a nonempty string. Omitting
either field or providing an empty array produces the existing missing-context
warning. Findings identify malformed entries by index, and malformed containers
produce field-specific errors. Rendered output remains inspectable: invalid
containers become empty sections, while invalid array entries become
`invalid approval item` or `invalid rollback item` in both structured and
Markdown receipts instead of stringifying objects or nulls.

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

## Change fields

Each `changes` entry must be an object with nonempty string `operation` and
`record` fields. The optional `summary` field must be a string when present;
an empty summary is treated the same as an omitted summary. `risk` must be one
of `low`, `medium`, or `high`.

Validation errors identify malformed fields by their zero-based path, such as
`changes[0].operation`. Failed receipts remain safe to inspect: invalid or
blank operations, records, and summaries render as `missing operation`,
`missing record`, and `no summary` instead of coercing objects or arrays into
output. Rendering still exits with status 1 until the input is corrected.

## Limitations

This package is local-first. It does not fetch private chat logs, call connectors, store credentials, or approve writes. Treat output as a review aid, not as proof that an external system changed.

## Safety notes

Run against redacted fixtures when possible. Review validation warnings before sharing reports outside the project context.
