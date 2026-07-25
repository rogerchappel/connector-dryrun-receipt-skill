# Orchestration

1. Gather a redacted JSON input from the agent run or dry-run planner.
2. Run `npm run smoke` or `node bin/connector-dryrun-receipt.js validate <file>`.
3. Give every change a `low`, `medium`, or `high` risk and use nonempty strings
   for every approval and rollback entry.
4. Fix validation errors before relying on the rendered artifact. Render commands
   still print failed receipts for inspection but exit with status 1. Unknown or
   missing risks render as `high` so uncertainty cannot lower `highestRisk`.
5. Paste the Markdown report into the release-candidate PR or handoff thread.
6. Keep external writes behind the original connector approval flow.
