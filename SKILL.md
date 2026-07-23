# Connector Dry-Run Receipt Skill

## When to use

Use this skill when an agent needs a local, reviewable connector artifact before handing work to a maintainer, PR reviewer, or connector approval flow.

## Required tools or inputs

- Node.js 18 or newer
- A redacted JSON input matching the fixtures in `fixtures/`
- Local shell access for `npm test`, `npm run check`, and `npm run smoke`

## Side-effect boundaries

The skill reads local files or stdin and writes only to stdout. It does not call external APIs, mutate remote systems, or approve connector writes.

## Approval requirements

Human or platform approval is still required before any external write. Treat this skill as a preparation and evidence tool.

## Examples

```bash
node bin/connector-dryrun-receipt.js validate fixtures/receipt.valid.json
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format markdown
```

Invalid shapes are safe to inspect: `validate` prints JSON findings and exits 1,
while `render` emits a failed receipt containing paths such as `$` or
`changes[0]`. Neither command should expose a raw JavaScript `TypeError`.

## Validation workflow

1. Run `npm run check`.
2. Run `npm test`.
3. Run `npm run smoke`.
4. Review warnings for missing approvals, missing verification, or secret-looking values.
