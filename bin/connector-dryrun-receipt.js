#!/usr/bin/env node
import { buildReceipt, readPlan, renderMarkdown, validatePlan } from "../src/index.js";

class UsageError extends Error {}

const argv = process.argv.slice(2);

if (argv.length === 1 && ["-h", "--help"].includes(argv[0])) {
  printHelp();
  process.exit(0);
}

try {
  const { command, filePath, format } = parseArguments(argv);
  const input = readPlan(filePath);
  if (command === "validate") {
    const result = validatePlan(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 1);
  }
  if (command === "render") {
    const receipt = buildReceipt(input);
    if (format === "markdown") process.stdout.write(renderMarkdown(input));
    else if (format === "json") process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exit(receipt.validation.ok ? 0 : 1);
  }
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`Usage error: ${error.message}\n`);
    printHelp(process.stderr);
    process.exit(2);
  }
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

function parseArguments(args) {
  const [command, filePath, ...rest] = args;

  if (!command) throw new UsageError("missing command");
  if (!filePath) throw new UsageError(`missing file operand for ${command}`);

  if (command === "validate") {
    if (rest.length > 0) throw new UsageError("validate accepts exactly one file operand");
    return { command, filePath };
  }

  if (command === "render") {
    if (rest.length === 0) return { command, filePath, format: "markdown" };
    if (rest.length !== 2 || rest[0] !== "--format") {
      throw new UsageError("render accepts one file operand and one optional --format value");
    }
    if (!["markdown", "json"].includes(rest[1])) {
      throw new UsageError("--format must be markdown or json");
    }
    return { command, filePath, format: rest[1] };
  }

  throw new UsageError(`unknown command: ${command}`);
}

function printHelp(stream = process.stdout) {
  stream.write(`Usage:\n  connector-dryrun-receipt validate <file|->\n  connector-dryrun-receipt render <file|-> [--format markdown|json]\n`);
}
