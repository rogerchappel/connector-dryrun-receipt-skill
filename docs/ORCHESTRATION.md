# Orchestration

1. Gather a redacted JSON input from the agent run or dry-run planner.
2. Run `npm run smoke` or `node bin/connector-dryrun-receipt.js validate <file>`.
3. Fix validation errors before relying on the rendered artifact.
4. Paste the Markdown report into the release-candidate PR or handoff thread.
5. Keep external writes behind the original connector approval flow.
