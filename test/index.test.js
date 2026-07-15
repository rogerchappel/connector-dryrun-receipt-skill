import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildReceipt, renderMarkdown, validatePlan } from "../src/index.js";

const valid = JSON.parse(readFileSync(new URL("../fixtures/receipt.valid.json", import.meta.url), "utf8"));
const invalid = JSON.parse(readFileSync(new URL("../fixtures/receipt.invalid.json", import.meta.url), "utf8"));

test("valid fixture passes validation", () => {
  const result = validatePlan(valid);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("invalid fixture reports actionable findings", () => {
  const result = validatePlan(invalid);
  assert.equal(result.ok, false);
  assert.match([...result.errors, ...result.warnings].join("\n"), /Secret-looking|missing|required|invalid/i);
});

test("markdown render includes receipt sections", () => {
  const rendered = renderMarkdown(valid);
  assert.match(rendered, /# /);
  assert.match(rendered, /Validation: pass/);
});

test("normalizer exposes validation and structured output", () => {
  const output = buildReceipt(valid);
  assert.equal(output.validation.ok, true);
  assert.ok(Object.keys(output).length > 2);
});

test("CLI validate exits successfully for valid fixture", () => {
  const output = execFileSync("node", ["bin/connector-dryrun-receipt.js", "validate", "fixtures/receipt.valid.json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.match(output, /"ok": true/);
});
