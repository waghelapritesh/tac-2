import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { tacRoot, _clearTacRootCache } from "../../paths.ts";
/** Create a tmp dir and resolve symlinks + 8.3 short names (macOS /var→/private/var, Windows RUNNER~1→runneradmin). */
function tmp(): string {
  const p = mkdtempSync(join(tmpdir(), "tac-paths-test-"));
  try { return realpathSync.native(p); } catch { return p; }
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function initGit(dir: string): void {
  spawnSync("git", ["init"], { cwd: dir });
  spawnSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: dir });
}

describe('paths', () => {
  test('Case 1: .tac exists at basePath — fast path', () => {
    const root = tmp();
    try {
      mkdirSync(join(root, ".tac"));
      _clearTacRootCache();
      const result = tacRoot(root);
      assert.deepStrictEqual(result, join(root, ".tac"), "fast path: returns basePath/.tac");
    } finally { cleanup(root); }
  });

  test('Case 2: .tac exists at git root, cwd is a subdirectory', () => {
    const root = tmp();
    try {
      initGit(root);
      mkdirSync(join(root, ".tac"));
      const sub = join(root, "src", "deep");
      mkdirSync(sub, { recursive: true });
      _clearTacRootCache();
      const result = tacRoot(sub);
      assert.deepStrictEqual(result, join(root, ".tac"), "git-root probe: finds .tac at git root from subdirectory");
    } finally { cleanup(root); }
  });

  test('Case 3: .tac in an ancestor — walk-up finds it', () => {
    const root = tmp();
    try {
      initGit(root);
      const project = join(root, "project");
      mkdirSync(join(project, ".tac"), { recursive: true });
      const deep = join(project, "src", "deep");
      mkdirSync(deep, { recursive: true });
      _clearTacRootCache();
      const result = tacRoot(deep);
      assert.deepStrictEqual(result, join(project, ".tac"), "walk-up: finds .tac in ancestor when git root has none");
    } finally { cleanup(root); }
  });

  test('Case 4: .tac nowhere — fallback returns original basePath/.tac', () => {
    const root = tmp();
    try {
      initGit(root);
      const sub = join(root, "src");
      mkdirSync(sub, { recursive: true });
      _clearTacRootCache();
      const result = tacRoot(sub);
      assert.deepStrictEqual(result, join(sub, ".tac"), "fallback: returns basePath/.tac when .tac not found anywhere");
    } finally { cleanup(root); }
  });

  test('Case 5: cache — second call returns same value without re-probing', () => {
    const root = tmp();
    try {
      mkdirSync(join(root, ".tac"));
      _clearTacRootCache();
      const first = tacRoot(root);
      const second = tacRoot(root);
      assert.deepStrictEqual(first, second, "cache: same result returned on second call");
      assert.ok(first === second, "cache: identity check (same string)");
    } finally { cleanup(root); }
  });

  test('Case 6: .tac at basePath takes precedence over ancestor .tac', () => {
    const outer = tmp();
    try {
      initGit(outer);
      mkdirSync(join(outer, ".tac"));
      const inner = join(outer, "nested");
      mkdirSync(join(inner, ".tac"), { recursive: true });
      _clearTacRootCache();
      const result = tacRoot(inner);
      assert.deepStrictEqual(result, join(inner, ".tac"), "precedence: nearest .tac wins over ancestor");
    } finally { cleanup(outer); }
  });
});
