/**
 * Tests for macOS numbered symlink variant cleanup (#2205).
 *
 * macOS can rename `.tac` to `.tac 2`, `.tac 3`, etc. when a directory
 * already exists at the target path. ensureTacSymlink() must detect and
 * remove these numbered variants so the real `.tac` symlink is always
 * the one in use.
 */

import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  lstatSync,
  realpathSync,
  mkdirSync,
  symlinkSync,
  readlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

import { ensureTacSymlink, externalTacRoot } from "../repo-identity.ts";
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';


function run(command: string, cwd: string): string {
  return execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" }).trim();
}

describe('symlink-numbered-variants', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "tac-symlink-variants-")));
  const stateDir = realpathSync(mkdtempSync(join(tmpdir(), "tac-state-variants-")));

  try {
    process.env.TAC_STATE_DIR = stateDir;

    // Set up a minimal git repo
    run("git init -b main", base);
    run('git config user.name "Pi Test"', base);
    run('git config user.email "pi@example.com"', base);
    run('git remote add origin git@github.com:example/repo.git', base);
    writeFileSync(join(base, "README.md"), "# Test Repo\n", "utf-8");
    run("git add README.md", base);
    run('git commit -m "chore: init"', base);

    const externalPath = externalTacRoot(base);

    // ── Test: numbered variant directories are cleaned up ──────────────
    console.log("\n=== ensureTacSymlink removes numbered .tac variants (#2205) ===");
    {
      // Simulate macOS creating numbered variants: ".tac 2", ".tac 3"
      mkdirSync(join(base, ".tac 2"), { recursive: true });
      mkdirSync(join(base, ".tac 3"), { recursive: true });
      mkdirSync(join(base, ".tac 4"), { recursive: true });

      const result = ensureTacSymlink(base);
      assert.deepStrictEqual(result, externalPath, "ensureTacSymlink returns external path");
      assert.ok(existsSync(join(base, ".tac")), ".tac exists after ensureTacSymlink");
      assert.ok(lstatSync(join(base, ".tac")).isSymbolicLink(), ".tac is a symlink");

      // The numbered variants must have been removed
      assert.ok(!existsSync(join(base, ".tac 2")), '".tac 2" directory was cleaned up');
      assert.ok(!existsSync(join(base, ".tac 3")), '".tac 3" directory was cleaned up');
      assert.ok(!existsSync(join(base, ".tac 4")), '".tac 4" directory was cleaned up');
    }

    // ── Test: numbered variant symlinks are cleaned up ─────────────────
    console.log("\n=== ensureTacSymlink removes numbered symlink variants ===");
    {
      // Clean slate
      rmSync(join(base, ".tac"), { recursive: true, force: true });

      // Simulate: ".tac 2" is a symlink to the correct target (the real .tac)
      // and ".tac" doesn't exist — this is the actual macOS scenario
      const staleTarget = join(stateDir, "projects", "stale-target");
      mkdirSync(staleTarget, { recursive: true });
      symlinkSync(externalPath, join(base, ".tac 2"), "junction");
      symlinkSync(staleTarget, join(base, ".tac 3"), "junction");

      const result = ensureTacSymlink(base);
      assert.deepStrictEqual(result, externalPath, "ensureTacSymlink returns external path when variants exist");
      assert.ok(existsSync(join(base, ".tac")), ".tac exists");
      assert.ok(lstatSync(join(base, ".tac")).isSymbolicLink(), ".tac is a symlink");

      assert.ok(!existsSync(join(base, ".tac 2")), '".tac 2" symlink variant was cleaned up');
      assert.ok(!existsSync(join(base, ".tac 3")), '".tac 3" symlink variant was cleaned up');
    }

    // ── Test: real .tac directory blocks symlink, but variants still cleaned ──
    console.log("\n=== ensureTacSymlink cleans variants even when .tac is a real directory ===");
    {
      // Clean slate
      rmSync(join(base, ".tac"), { recursive: true, force: true });

      // .tac is a real directory (git-tracked) and numbered variants exist
      mkdirSync(join(base, ".tac", "milestones"), { recursive: true });
      writeFileSync(join(base, ".tac", "milestones", "M001.md"), "# M001\n", "utf-8");
      mkdirSync(join(base, ".tac 2"), { recursive: true });
      mkdirSync(join(base, ".tac 3"), { recursive: true });

      const result = ensureTacSymlink(base);
      // When .tac is a real directory, ensureTacSymlink preserves it
      assert.deepStrictEqual(result, join(base, ".tac"), "real .tac directory preserved");
      assert.ok(lstatSync(join(base, ".tac")).isDirectory(), ".tac remains a directory");

      // But the numbered variants should still be cleaned up
      assert.ok(!existsSync(join(base, ".tac 2")), '".tac 2" cleaned even when .tac is a directory');
      assert.ok(!existsSync(join(base, ".tac 3")), '".tac 3" cleaned even when .tac is a directory');
    }

    // ── Test: only numeric-suffixed variants are removed ───────────────
    console.log("\n=== ensureTacSymlink only removes .tac + space + digit variants ===");
    {
      rmSync(join(base, ".tac"), { recursive: true, force: true });

      // These should NOT be touched
      mkdirSync(join(base, ".tac-backup"), { recursive: true });
      mkdirSync(join(base, ".tac_old"), { recursive: true });

      // These SHOULD be removed (macOS collision pattern)
      mkdirSync(join(base, ".tac 2"), { recursive: true });
      mkdirSync(join(base, ".tac 10"), { recursive: true });

      ensureTacSymlink(base);

      assert.ok(existsSync(join(base, ".tac-backup")), ".tac-backup is NOT removed");
      assert.ok(existsSync(join(base, ".tac_old")), ".tac_old is NOT removed");
      assert.ok(!existsSync(join(base, ".tac 2")), '".tac 2" removed');
      assert.ok(!existsSync(join(base, ".tac 10")), '".tac 10" removed');

      // Cleanup non-variant dirs
      rmSync(join(base, ".tac-backup"), { recursive: true, force: true });
      rmSync(join(base, ".tac_old"), { recursive: true, force: true });
    }

  } finally {
    delete process.env.TAC_STATE_DIR;
    try { rmSync(base, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(stateDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});
