import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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

test("publish dry-run preserves the packaged CLI metadata and installed executable", () => {
  const workspace = mkdtempSync(join(tmpdir(), "connector-dryrun-receipt-publish-"));

  try {
    const publish = spawnSync("npm", ["publish", "--dry-run", "--json"], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    assert.equal(publish.status, 0, publish.stderr);
    assert.doesNotMatch(publish.stderr, /auto-corrected|invalid and removed/i);

    const packResult = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", workspace], {
      cwd: projectRoot,
      encoding: "utf8"
    }));
    const tarball = join(workspace, packResult[0].filename);
    const packagedManifest = JSON.parse(execFileSync("tar", ["-xOzf", tarball, "package/package.json"], {
      encoding: "utf8"
    }));
    assert.deepEqual(packagedManifest.bin, {
      "connector-dryrun-receipt": "bin/connector-dryrun-receipt.js"
    });

    execFileSync("npm", ["init", "--yes"], { cwd: workspace, stdio: "ignore" });
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
      cwd: workspace,
      stdio: "ignore"
    });
    const output = execFileSync(
      join(workspace, "node_modules", ".bin", "connector-dryrun-receipt"),
      ["validate", join(projectRoot.pathname, "fixtures", "receipt.valid.json")],
      { cwd: workspace, encoding: "utf8" }
    );
    assert.match(output, /"ok": true/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
