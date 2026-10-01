import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("CI pins third-party actions to reviewed immutable revisions", () => {
  const uses = [...workflow.matchAll(/^\s+(?:-\s+)?uses: ([^\s#]+)(?:\s+#\s*(.+))?$/gm)];
  assert.deepEqual(uses.map(([, ref, version]) => [ref, version]), [
    ["actions/checkout@11d5960a326750d5838078e36cf38b85af677262", "v4.2.2"],
    ["actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "v4.4.0"]
  ]);
  for (const [, ref] of uses) assert.match(ref, /^[^@]+@[0-9a-f]{40}$/);
});

test("CI grants only read access to repository contents", () => {
  assert.match(workflow, /^permissions:\n  contents: read\s*$/m);
});
