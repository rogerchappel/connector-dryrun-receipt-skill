# Examples

```bash
node bin/connector-dryrun-receipt.js validate fixtures/receipt.valid.json
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format markdown
node bin/connector-dryrun-receipt.js render fixtures/receipt.valid.json --format json
```

Use the invalid fixture to confirm failures and warnings are visible:

```bash
node bin/connector-dryrun-receipt.js validate fixtures/receipt.invalid.json
```
