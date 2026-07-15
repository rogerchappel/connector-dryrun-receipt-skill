#!/usr/bin/env node
import { buildReceipt, readPlan, renderMarkdown, validatePlan } from "../src/index.js";

const [command, filePath, ...args] = process.argv.slice(2);

if (!command || !filePath || ["-h", "--help"].includes(command)) {
  printHelp();
  process.exit(command ? 0 : 1);
}

try {
  const input = readPlan(filePath);
  if (command === "validate") {
    const result = validatePlan(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 1);
  }
  if (command === "render") {
    const format = readOption(args, "--format") || "markdown";
    if (format === "markdown") process.stdout.write(renderMarkdown(input));
    else if (format === "json") process.stdout.write(`${JSON.stringify(buildReceipt(input), null, 2)}\n`);
    else throw new Error(`Unsupported format: ${format}`);
    process.exit(0);
  }
  throw new Error(`Unknown command: ${command}`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp() {
  process.stdout.write(`connector-dryrun-receipt\n\nUsage:\n  connector-dryrun-receipt validate <file|->\n  connector-dryrun-receipt render <file|-> --format markdown|json\n`);
}
