# Connector Dry-Run Receipt Skill

Local-first skill for rendering connector dry-run plans into reviewable approval receipts.

## Quickstart

```bash
npm test
npm run smoke
node bin/connector-dryrun-receipt.js validate fixtures/receipt.valid.json
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format json
```

## What it does

- Validates a local JSON fixture before an agent uses it in a handoff or approval flow.
- Renders a Markdown artifact that can be pasted into a PR, issue, Slack thread, or run report.
- Flags missing verification or approval context without calling external services.
- Keeps secret-looking values visible only as validation warnings; it does not transmit data.

## Library API

```js
import { renderMarkdown } from "connector-dryrun-receipt-skill";

const markdown = renderMarkdown(input);
```

## Limitations

This package is local-first. It does not fetch private chat logs, call connectors, store credentials, or approve writes. Treat output as a review aid, not as proof that an external system changed.

## Safety notes

Run against redacted fixtures when possible. Review validation warnings before sharing reports outside the project context.
