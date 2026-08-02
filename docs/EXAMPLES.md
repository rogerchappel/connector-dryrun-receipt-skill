# Examples

```bash
node bin/connector-dryrun-receipt.js validate fixtures/receipt.valid.json
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format markdown
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format json
cat fixtures/receipt.valid.json | node bin/connector-dryrun-receipt.js validate -
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
