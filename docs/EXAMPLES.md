# Examples

```bash
node bin/connector-dryrun-receipt.js validate fixtures/receipt.valid.json
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format markdown
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format json
cat fixtures/receipt.valid.json | node bin/connector-dryrun-receipt.js validate -
```

Plan text is always rendered literally in Markdown. Embedded line breaks are
folded and Markdown punctuation is escaped, so this input cannot add a heading:

```bash
printf '%s' '{"id":"demo","connector":"crm","action":"update","target":"lead","approvalMode":"review","changes":[{"operation":"update","record":"lead-1","risk":"low","summary":"first line\\n## not a heading"}]}' | node bin/connector-dryrun-receipt.js render -
```

Use the invalid fixture to confirm failures and warnings are visible:

```bash
node bin/connector-dryrun-receipt.js validate fixtures/receipt.invalid.json
```

An omitted file, extra positional argument, unknown or duplicate option, missing
format value, or format other than `markdown` or `json` is a usage error. These
fail before reading input, write the usage summary to stderr, and exit with status
2. For example, this is rejected rather than silently rendering Markdown:

```bash
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format
```
