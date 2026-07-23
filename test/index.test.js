import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildReceipt, renderMarkdown, validatePlan } from "../src/index.js";

const projectRoot = new URL("..", import.meta.url);
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

test("library APIs report non-object plans without throwing", () => {
  for (const plan of [null, 42, "plan"]) {
    const validation = validatePlan(plan);
    assert.deepEqual(validation.errors, ["$ must be an object."]);
    assert.equal(validation.ok, false);

    const receipt = buildReceipt(plan);
    assert.deepEqual(receipt.changes, []);
    assert.deepEqual(receipt.validation.errors, ["$ must be an object."]);

    const markdown = renderMarkdown(plan);
    assert.match(markdown, /Validation: fail/);
    assert.match(markdown, /error: \$ must be an object\./);
  }
});

test("library APIs report non-object change entries by path", () => {
  for (const change of [null, 42, "change"]) {
    const plan = { ...valid, changes: [change] };
    const validation = validatePlan(plan);
    assert.deepEqual(validation.errors, ["changes[0] must be an object."]);

    const receipt = buildReceipt(plan);
    assert.deepEqual(receipt.changes, [change]);
    assert.match(renderMarkdown(plan), /missing operation missing record/);
  }
});

test("CLI validate exits successfully for valid fixture", () => {
  const output = execFileSync("node", ["bin/connector-dryrun-receipt.js", "validate", "fixtures/receipt.valid.json"], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.match(output, /"ok": true/);
});

test("CLI commands handle invalid root and change shapes without raw type errors", () => {
  for (const [command, input] of [
    ["validate", "null"],
    ["render", JSON.stringify({ ...valid, changes: [null, 7] })]
  ]) {
    const args = ["bin/connector-dryrun-receipt.js", command, "-", ...(command === "render" ? ["--format", "markdown"] : [])];
    const result = spawnSync("node", args, { cwd: projectRoot, encoding: "utf8", input });

    assert.equal(result.stderr, "");
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /TypeError/);
    assert.match(result.stdout, command === "validate" ? /\$ must be an object/ : /changes\[0\] must be an object/);
    assert.equal(result.status, command === "validate" ? 1 : 0);
  }
});
