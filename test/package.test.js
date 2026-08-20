import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const projectRoot = new URL("..", import.meta.url);

test("packed package exposes the documented ESM API", () => {
  const workspace = mkdtempSync(join(tmpdir(), "connector-dryrun-receipt-package-"));

  try {
    const packResult = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", workspace], {
      cwd: projectRoot,
      encoding: "utf8"
    }));
    const tarball = join(workspace, packResult[0].filename);
    const packagedLicense = execFileSync("tar", ["-xOzf", tarball, "package/LICENSE"], {
      encoding: "utf8"
    });
    const consumer = join(workspace, "consumer.mjs");
    const fixture = readFileSync(new URL("../fixtures/receipt.valid.json", import.meta.url), "utf8");

    execFileSync("npm", ["init", "--yes"], { cwd: workspace, stdio: "ignore" });
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
      cwd: workspace,
      stdio: "ignore"
    });
    writeFileSync(
      consumer,
      [
        'import { renderMarkdown } from "connector-dryrun-receipt-skill";',
        `const input = ${fixture};`,
        "process.stdout.write(renderMarkdown(input));"
      ].join("\n")
    );

    const output = execFileSync("node", [consumer], { cwd: workspace, encoding: "utf8" });
    assert.match(output, /# Connector Dry-Run Receipt:/);
    assert.match(output, /Validation: pass/);
    assert.match(
      packagedLicense,
      /The above copyright notice and this permission notice shall be included in all\s+copies or substantial portions of the Software\./
    );
    assert.match(packagedLicense, /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/);
    assert.match(packagedLicense, /IN NO EVENT SHALL THE\s+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
