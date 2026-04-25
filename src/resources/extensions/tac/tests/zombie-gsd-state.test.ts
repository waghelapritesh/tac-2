/**
 * zombie-tac-state.test.ts — #2942
 *
 * A partially initialized `.tac/` (symlink exists but neither `PREFERENCES.md`
 * nor `milestones/` is present) previously caused the init-wizard gate in
 * `showSmartEntry` to be skipped. The fix introduces
 * `hasTacBootstrapArtifacts`, which requires at least one bootstrap artifact
 * to be present before treating the project as initialized.
 *
 * These tests exercise that helper directly over synthetic filesystems and
 * injected predicates — replacing the old source-grep assertions that only
 * verified the function's *text* shape.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { hasTacBootstrapArtifacts } from "../detection.ts";

function makeTacDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "tac-zombie-state-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("#2942: missing .tac/ directory entirely → treated as un-bootstrapped", () => {
  assert.equal(
    hasTacBootstrapArtifacts("/nonexistent/path/does/not/exist/.tac"),
    false,
  );
});

test("#2942: zombie .tac/ (empty directory) must NOT count as bootstrapped", (t) => {
  const tac = makeTacDir(t);
  // Only the directory exists — neither PREFERENCES.md nor milestones/
  assert.equal(
    hasTacBootstrapArtifacts(tac),
    false,
    "an empty .tac/ is a zombie state — init wizard must still run",
  );
});

test("#2942: .tac/ with PREFERENCES.md counts as bootstrapped", (t) => {
  const tac = makeTacDir(t);
  writeFileSync(join(tac, "PREFERENCES.md"), "# prefs\n");
  assert.equal(hasTacBootstrapArtifacts(tac), true);
});

test("#2942: .tac/ with milestones/ directory counts as bootstrapped", (t) => {
  const tac = makeTacDir(t);
  mkdirSync(join(tac, "milestones"));
  assert.equal(hasTacBootstrapArtifacts(tac), true);
});

test("#2942: both artifacts present → bootstrapped", (t) => {
  const tac = makeTacDir(t);
  writeFileSync(join(tac, "PREFERENCES.md"), "# prefs\n");
  mkdirSync(join(tac, "milestones"));
  assert.equal(hasTacBootstrapArtifacts(tac), true);
});

test("#2942: injected existsFn — zombie via predicate is rejected", () => {
  // Only the .tac/ directory exists; artifacts are missing.
  const existsFn = (p: string) => p === "/proj/.tac";
  assert.equal(hasTacBootstrapArtifacts("/proj/.tac", existsFn), false);
});

test("#2942: injected existsFn — PREFERENCES.md alone is enough", () => {
  const existsFn = (p: string) =>
    p === "/proj/.tac" || p === "/proj/.tac/PREFERENCES.md";
  assert.equal(hasTacBootstrapArtifacts("/proj/.tac", existsFn), true);
});

test("#2942: injected existsFn — milestones/ alone is enough", () => {
  const existsFn = (p: string) =>
    p === "/proj/.tac" || p === "/proj/.tac/milestones";
  assert.equal(hasTacBootstrapArtifacts("/proj/.tac", existsFn), true);
});
