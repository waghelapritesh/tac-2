/**
 * gitignore-tracked-tac.test.ts — Regression tests for #1364.
 *
 * Verifies that ensureGitignore() does NOT add ".tac" to .gitignore
 * when .tac/ contains git-tracked files, and that migrateToExternalState()
 * aborts migration for tracked .tac/ directories.
 *
 * Uses real temporary git repos — no mocks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ensureGitignore, hasGitTrackedTacFiles } from "../../gitignore.ts";
import { migrateToExternalState } from "../../migrate-external.ts";

// ─── Helpers ─────────────────────────────────────────────────────────

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, stdio: "pipe", encoding: "utf-8" }).trim();
}

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "tac-gitignore-test-"));
  git(dir, "init");
  git(dir, "config", "user.email", "test@test.com");
  git(dir, "config", "user.name", "Test");
  writeFileSync(join(dir, "README.md"), "# init\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-m", "init");
  git(dir, "branch", "-M", "main");
  return dir;
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ─── hasGitTrackedTacFiles ───────────────────────────────────────────

test("hasGitTrackedTacFiles returns false when .tac/ does not exist", (t) => {
  const dir = makeTempRepo();
  t.after(() => { cleanup(dir); });

  assert.equal(hasGitTrackedTacFiles(dir), false);
});

test("hasGitTrackedTacFiles returns true when .tac/ has tracked files", (t) => {
  const dir = makeTempRepo();
  t.after(() => { cleanup(dir); });

  mkdirSync(join(dir, ".tac", "milestones"), { recursive: true });
  writeFileSync(join(dir, ".tac", "PROJECT.md"), "# Test Project\n");
  git(dir, "add", ".tac/PROJECT.md");
  git(dir, "commit", "-m", "add tac");
  assert.equal(hasGitTrackedTacFiles(dir), true);
});

test("hasGitTrackedTacFiles returns false when .tac/ exists but is untracked", (t) => {
  const dir = makeTempRepo();
  t.after(() => { cleanup(dir); });

  mkdirSync(join(dir, ".tac"), { recursive: true });
  writeFileSync(join(dir, ".tac", "STATE.md"), "state\n");
  // Not git-added — should return false
  assert.equal(hasGitTrackedTacFiles(dir), false);
});

// ─── ensureGitignore — tracked .tac/ protection ─────────────────────

test("ensureGitignore does NOT add .tac when .tac/ has tracked files (#1364)", (t) => {
  const dir = makeTempRepo();
  try {
    // Set up .tac/ with tracked files
    mkdirSync(join(dir, ".tac", "milestones"), { recursive: true });
    writeFileSync(join(dir, ".tac", "PROJECT.md"), "# Test Project\n");
    writeFileSync(join(dir, ".tac", "DECISIONS.md"), "# Decisions\n");
    git(dir, "add", ".tac/");
    git(dir, "commit", "-m", "track tac state");

    // Run ensureGitignore
    ensureGitignore(dir);

    // Verify .tac is NOT in .gitignore
    const gitignore = readFileSync(join(dir, ".gitignore"), "utf-8");
    const lines = gitignore.split("\n").map((l) => l.trim());
    assert.ok(
      !lines.includes(".tac"),
      `Expected .tac NOT to appear in .gitignore, but it does:\n${gitignore}`,
    );

    // Other baseline patterns should still be present
    assert.ok(lines.includes(".DS_Store"), "Expected .DS_Store in .gitignore");
    assert.ok(lines.includes("node_modules/"), "Expected node_modules/ in .gitignore");
    assert.ok(lines.includes(".mcp.json"), "Expected .mcp.json in .gitignore");
  } finally {
    cleanup(dir);
  }
});

test("ensureGitignore adds .tac when .tac/ has NO tracked files", (t) => {
  const dir = makeTempRepo();
  try {
    // Run ensureGitignore (no .tac/ at all)
    ensureGitignore(dir);

    // Verify .tac IS in .gitignore
    const gitignore = readFileSync(join(dir, ".gitignore"), "utf-8");
    const lines = gitignore.split("\n").map((l) => l.trim());
    assert.ok(
      lines.includes(".tac"),
      `Expected .tac in .gitignore, but it's missing:\n${gitignore}`,
    );
  } finally {
    cleanup(dir);
  }
});

test("ensureGitignore respects manageGitignore: false", (t) => {
  const dir = makeTempRepo();
  t.after(() => { cleanup(dir); });

  const result = ensureGitignore(dir, { manageGitignore: false });
  assert.equal(result, false);
  assert.ok(!existsSync(join(dir, ".gitignore")), "Should not create .gitignore");
});

// ─── ensureGitignore — verify no tracked files become invisible ─────

test("ensureGitignore with tracked .tac/ does not cause git to see files as deleted", (t) => {
  const dir = makeTempRepo();
  try {
    // Create tracked .tac/ files
    mkdirSync(join(dir, ".tac", "milestones", "M001"), { recursive: true });
    writeFileSync(join(dir, ".tac", "PROJECT.md"), "# Project\n");
    writeFileSync(
      join(dir, ".tac", "milestones", "M001", "M001-CONTEXT.md"),
      "# M001\n",
    );
    git(dir, "add", ".tac/");
    git(dir, "commit", "-m", "track tac state");

    // Run ensureGitignore
    ensureGitignore(dir);

    // git status should show NO deleted files under .tac/
    const status = git(dir, "status", "--porcelain", ".tac/");

    // Filter for deletions (lines starting with " D" or "D ")
    const deletions = status
      .split("\n")
      .filter((l) => l.match(/^\s*D\s/) || l.match(/^D\s/));

    assert.equal(
      deletions.length,
      0,
      `Expected no deleted .tac/ files, but found:\n${deletions.join("\n")}`,
    );
  } finally {
    cleanup(dir);
  }
});

test("hasGitTrackedTacFiles returns true (fail-safe) when git is not available", (t) => {
  const dir = makeTempRepo();
  try {
    // Create and track .tac/ files
    mkdirSync(join(dir, ".tac"), { recursive: true });
    writeFileSync(join(dir, ".tac", "PROJECT.md"), "# Project\n");
    git(dir, "add", ".tac/");
    git(dir, "commit", "-m", "track tac");

    // Corrupt the git index to simulate git failure
    const indexPath = join(dir, ".git", "index.lock");
    writeFileSync(indexPath, "locked");

    // Should fail safe — assume tracked rather than silently returning false
    // (The index lock causes git ls-files to fail; rev-parse also fails → true)
    const result = hasGitTrackedTacFiles(dir);
    assert.equal(result, true, "Should return true (fail-safe) when git is unavailable");
  } finally {
    cleanup(dir);
  }
});

// ─── migrateToExternalState — tracked .tac/ protection ──────────────

test("migrateToExternalState aborts when .tac/ has tracked files (#1364)", (t) => {
  const dir = makeTempRepo();
  try {
    // Create tracked .tac/ files
    mkdirSync(join(dir, ".tac", "milestones"), { recursive: true });
    writeFileSync(join(dir, ".tac", "PROJECT.md"), "# Project\n");
    git(dir, "add", ".tac/");
    git(dir, "commit", "-m", "track tac state");

    // Attempt migration — should abort without moving anything
    const result = migrateToExternalState(dir);

    assert.equal(result.migrated, false, "Should NOT migrate tracked .tac/");
    assert.equal(result.error, undefined, "Should not report an error — just skip");

    // .tac/ should still be a real directory, not a symlink
    assert.ok(existsSync(join(dir, ".tac", "PROJECT.md")), ".tac/PROJECT.md should still exist");

    // No .tac.migrating should exist
    assert.ok(
      !existsSync(join(dir, ".tac.migrating")),
      ".tac.migrating should not exist",
    );
  } finally {
    cleanup(dir);
  }
});

test("migrateToExternalState cleans git index so tracked files don't show as deleted (#1364 path 2)", (t) => {
  const dir = makeTempRepo();
  try {
    // Track .tac/ files, then untrack them so migration proceeds
    mkdirSync(join(dir, ".tac", "milestones", "M001"), { recursive: true });
    writeFileSync(join(dir, ".tac", "PROJECT.md"), "# Project\n");
    writeFileSync(join(dir, ".tac", "milestones", "M001", "PLAN.md"), "# Plan\n");
    git(dir, "add", ".tac/");
    git(dir, "commit", "-m", "track tac state");
    git(dir, "rm", "-r", "--cached", ".tac/");
    git(dir, "commit", "-m", "untrack tac (simulates pre-migration project)");

    const result = migrateToExternalState(dir);
    assert.equal(result.migrated, true, "Migration should succeed");

    // git status must show NO deleted files after migration
    const status = git(dir, "status", "--porcelain");
    const deletions = status.split("\n").filter((l) => /^\s*D\s/.test(l) || /^D\s/.test(l));
    assert.equal(
      deletions.length,
      0,
      `Expected no deleted files after migration, but found:\n${deletions.join("\n")}`,
    );
  } finally {
    cleanup(dir);
  }
});
