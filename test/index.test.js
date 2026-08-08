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

test("unknown and missing risks fail validation and normalize conservatively", () => {
  for (const risk of ["critical", undefined]) {
    const change = { ...valid.changes[0] };
    if (risk === undefined) delete change.risk;
    else change.risk = risk;
    const plan = { ...valid, changes: [change] };

    const validation = validatePlan(plan);
    assert.equal(validation.ok, false);
    assert.deepEqual(validation.errors, ["changes[0].risk must be low, medium, or high."]);

    const receipt = buildReceipt(plan);
    assert.equal(receipt.changes[0].risk, "high");
    assert.equal(receipt.highestRisk, "high");
  }
});

test("approval and rollback entries must be usable strings", () => {
  const plan = {
    ...valid,
    approvals: ["approved", {}, null, "   "],
    rollback: ["restore snapshot", 42, ""]
  };
  const validation = validatePlan(plan);

  assert.equal(validation.ok, false);
  assert.deepEqual(validation.errors, [
    "approvals[1] must be a nonempty string.",
    "approvals[2] must be a nonempty string.",
    "approvals[3] must be a nonempty string.",
    "rollback[1] must be a nonempty string.",
    "rollback[2] must be a nonempty string."
  ]);

  const markdown = renderMarkdown(plan);
  assert.match(markdown, /- approved/);
  assert.match(markdown, /- invalid approval item/);
  assert.match(markdown, /- invalid rollback item/);
  assert.doesNotMatch(markdown, /\[object Object\]|- null/);
  assert.match(markdown, /Validation: fail/);
});

test("approval and rollback containers must be arrays when present", () => {
  for (const value of [{ reviewer: "alice" }, "approved", null, 42]) {
    for (const field of ["approvals", "rollback"]) {
      const plan = { ...valid, [field]: value };
      const validation = validatePlan(plan);
      const receipt = buildReceipt(plan);
      const markdown = renderMarkdown(plan);

      assert.equal(validation.ok, false);
      assert.ok(validation.errors.includes(`${field} must be an array when present.`));
      assert.deepEqual(receipt[field], []);
      assert.match(markdown, /Validation: fail/);
      assert.match(markdown, new RegExp(`error: ${field} must be an array when present\\.`));
      assert.match(markdown, field === "approvals" ? /## Approval Checklist\n\n- none recorded/ : /## Rollback Notes\n\n- none recorded/);
      assert.doesNotMatch(markdown, /\[object Object\]/);
    }
  }
});

test("omitted and empty approval and rollback arrays retain warnings", () => {
  for (const field of ["approvals", "rollback"]) {
    for (const mode of ["omitted", "empty"]) {
      const plan = { ...valid };
      if (mode === "omitted") delete plan[field];
      else plan[field] = [];
      const validation = validatePlan(plan);

      assert.equal(validation.ok, true);
      assert.deepEqual(validation.errors, []);
      assert.ok(validation.warnings.includes(field === "approvals"
        ? "No approval checklist items recorded."
        : "No rollback notes recorded."));
    }
  }
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

test("CLI commands accept valid file and stdin invocations", () => {
  for (const [command, source, extraArgs] of [
    ["validate", "fixtures/receipt.valid.json", []],
    ["render", "fixtures/receipt.valid.json", []],
    ["render", "fixtures/receipt.valid.json", ["--format", "markdown"]],
    ["render", "fixtures/receipt.valid.json", ["--format", "json"]]
  ]) {
    const result = spawnSync(
      "node",
      ["bin/connector-dryrun-receipt.js", command, source, ...extraArgs],
      { cwd: projectRoot, encoding: "utf8" }
    );

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.notEqual(result.stdout, "");
  }

  for (const command of ["validate", "render"]) {
    const result = spawnSync(
      "node",
      ["bin/connector-dryrun-receipt.js", command, "-"],
      { cwd: projectRoot, encoding: "utf8", input: JSON.stringify(valid) }
    );

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.notEqual(result.stdout, "");
  }
});

test("CLI rejects malformed command arguments with a stable usage error", () => {
  const invalidInvocations = [
    [],
    ["validate"],
    ["validate", "fixtures/receipt.valid.json", "unexpected"],
    ["validate", "fixtures/receipt.valid.json", "--format", "json"],
    ["render"],
    ["render", "fixtures/receipt.valid.json", "extra"],
    ["render", "fixtures/receipt.valid.json", "--format"],
    ["render", "fixtures/receipt.valid.json", "--format", "yaml"],
    ["render", "fixtures/receipt.valid.json", "--format", "json", "--format", "markdown"],
    ["render", "fixtures/receipt.valid.json", "--bogus", "value"],
    ["unknown", "fixtures/receipt.valid.json"]
  ];

  for (const args of invalidInvocations) {
    const result = spawnSync(
      "node",
      ["bin/connector-dryrun-receipt.js", ...args],
      { cwd: projectRoot, encoding: "utf8" }
    );

    assert.equal(result.status, 2, `expected usage failure for: ${args.join(" ")}`);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^Usage error: .+\nUsage:/);
  }
});

test("CLI commands handle invalid root and change shapes without raw type errors", () => {
  for (const [command, input, finding] of [
    ["validate", "null", "$ must be an object"],
    ["validate", "42", "$ must be an object"],
    ["validate", JSON.stringify({ ...valid, changes: [null, 7] }), "changes[0] must be an object"],
    ["render", "null", "$ must be an object"],
    ["render", "42", "$ must be an object"],
    ["render", JSON.stringify({ ...valid, changes: [null, 7] }), "changes[0] must be an object"]
  ]) {
    const args = ["bin/connector-dryrun-receipt.js", command, "-", ...(command === "render" ? ["--format", "markdown"] : [])];
    const result = spawnSync("node", args, { cwd: projectRoot, encoding: "utf8", input });

    assert.equal(result.stderr, "");
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /TypeError/);
    assert.ok(result.stdout.includes(finding));
    assert.equal(result.status, 1);
  }
});

test("CLI render reports invalid risks in JSON and Markdown and exits unsuccessfully", () => {
  const input = JSON.stringify({
    ...valid,
    changes: [{ ...valid.changes[0], risk: "critical" }]
  });

  for (const format of ["json", "markdown"]) {
    const result = spawnSync(
      "node",
      ["bin/connector-dryrun-receipt.js", "render", "-", "--format", format],
      { cwd: projectRoot, encoding: "utf8", input }
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /high/);
    assert.match(result.stdout, /changes\[0\]\.risk must be low, medium, or high/);
    if (format === "json") {
      const receipt = JSON.parse(result.stdout);
      assert.equal(receipt.highestRisk, "high");
      assert.equal(receipt.changes[0].risk, "high");
      assert.equal(receipt.validation.ok, false);
    } else {
      assert.match(result.stdout, /Validation: fail/);
      assert.match(result.stdout, /\(high\)/);
    }
  }
});

test("CLI validate and render reject malformed approval and rollback containers", () => {
  for (const value of [{ reviewer: "alice" }, "approved", null, 42]) {
    for (const field of ["approvals", "rollback"]) {
      const input = JSON.stringify({ ...valid, [field]: value });
      for (const [command, extraArgs] of [
        ["validate", []],
        ["render", ["--format", "json"]],
        ["render", ["--format", "markdown"]]
      ]) {
        const result = spawnSync(
          "node",
          ["bin/connector-dryrun-receipt.js", command, "-", ...extraArgs],
          { cwd: projectRoot, encoding: "utf8", input }
        );

        assert.equal(result.status, 1);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, new RegExp(`${field} must be an array when present\\.`));
        assert.doesNotMatch(result.stdout, /\[object Object\]/);
        if (command === "render") assert.match(result.stdout, extraArgs[1] === "json" ? new RegExp(`"${field}": \\[\\]`) : /- none recorded/);
      }
    }
  }
});

const malformedChangeValues = [42, { text: "bad" }, ["bad"], null, "   "];

test("change fields report indexed errors and normalize receipt output", () => {
  for (const value of malformedChangeValues) {
    const plan = { ...valid, changes: [{ operation: value, record: value, risk: "low", summary: value }] };
    const validation = validatePlan(plan);
    const receipt = buildReceipt(plan);
    const markdown = renderMarkdown(plan);

    assert.equal(validation.ok, false);
    assert.ok(validation.errors.includes("changes[0].operation must be a nonempty string."));
    assert.ok(validation.errors.includes("changes[0].record must be a nonempty string."));
    if (typeof value === "string") assert.ok(!validation.errors.some((error) => error.includes("changes[0].summary")));
    else assert.ok(validation.errors.includes("changes[0].summary must be a string when present."));
    assert.deepEqual(receipt.changes[0], {
      operation: "missing operation",
      record: "missing record",
      risk: "low",
      summary: "no summary"
    });
    assert.doesNotMatch(JSON.stringify(receipt), /\[object Object\]/);
    assert.doesNotMatch(markdown, /\[object Object\]/);
    assert.match(markdown, /missing operation missing record \(low\): no summary/);
  }
});

test("CLI rejects malformed change fields with conservative JSON and Markdown", () => {
  for (const value of malformedChangeValues) {
    const input = JSON.stringify({ ...valid, changes: [{ operation: value, record: value, risk: "low", summary: value }] });
    for (const format of ["json", "markdown"]) {
      const result = spawnSync("node", ["bin/connector-dryrun-receipt.js", "render", "-", "--format", format], {
        cwd: projectRoot,
        encoding: "utf8",
        input
      });

      assert.equal(result.status, 1);
      assert.match(result.stdout, /changes\[0\]\.operation/);
      assert.match(result.stdout, /changes\[0\]\.record/);
      if (typeof value !== "string") assert.match(result.stdout, /changes\[0\]\.summary/);
      assert.doesNotMatch(result.stdout, /\[object Object\]/);
      assert.match(result.stdout, /missing operation/);
      assert.match(result.stdout, /missing record/);
      assert.match(result.stdout, /no summary/);
    }
  }
});
