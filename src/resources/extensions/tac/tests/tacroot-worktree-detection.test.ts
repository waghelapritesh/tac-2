/**
 * tacroot-worktree-detection.test.ts — Regression test for #2594.
 *
 * tacRoot() must return the worktree's own .tac directory when the basePath
 * is inside a .tac/worktrees/<name>/ structure, not walk up to the project
 * root's .tac via the git-root probe.
 *
 * The bug: when a git worktree lives at /project/.tac/worktrees/M008/,
 * probeTacRoot() runs `git rev-parse --show-toplevel` which can return the
 * main project root (not the worktree root) depending on git version and
 * worktree setup. The walk-up then finds /project/.tac and returns that
 * instead of the worktree's own .tac path.
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { tacRoot, _clearTacRootCache } from "../paths.ts";

describe("tacRoot() worktree detection (#2594)", () => {
  let projectRoot: string;
  let projectTac: string;

  beforeEach(() => {
    _clearTacRootCache();
    // Create a temporary project with a git repo to simulate real conditions.
    // realpathSync handles macOS /tmp -> /private/tmp.
    projectRoot = realpathSync(mkdtempSync(join(tmpdir(), "tacroot-wt-")));
    projectTac = join(projectRoot, ".tac");
    mkdirSync(projectTac, { recursive: true });

    // Initialize a git repo in the project root so git rev-parse works
    spawnSync("git", ["init", "--initial-branch=main"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    spawnSync("git", ["config", "user.email", "test@test.com"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    spawnSync("git", ["config", "user.name", "Test"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    // Create an initial commit so we have a HEAD
    writeFileSync(join(projectRoot, "README.md"), "# Test");
    spawnSync("git", ["add", "."], { cwd: projectRoot, stdio: "ignore" });
    spawnSync("git", ["commit", "-m", "init"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
  });

  afterEach(() => {
    _clearTacRootCache();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  test("returns worktree .tac when basePath is a worktree with its own .tac (fast path)", () => {
    // Simulates a worktree that already had copyPlanningArtifacts() run,
    // so it has its own .tac/ directory.
    const worktreeBase = join(projectTac, "worktrees", "M008");
    const worktreeTac = join(worktreeBase, ".tac");
    mkdirSync(worktreeTac, { recursive: true });

    const result = tacRoot(worktreeBase);
    assert.equal(
      result,
      worktreeTac,
      `Expected worktree .tac (${worktreeTac}), got ${result}. ` +
        "tacRoot() should use the fast path for an existing worktree .tac.",
    );
  });

  test("returns worktree .tac path (not project root .tac) when worktree .tac does not exist yet", () => {
    // This is the core #2594 bug: the worktree directory exists but its .tac
    // subdirectory hasn't been created yet. Without the fix, probeTacRoot()
    // walks up from the worktree path, finds /project/.tac, and returns it.
    // With the fix, it detects the .tac/worktrees/<name>/ pattern and returns
    // the worktree-local .tac path as the creation fallback.
    const worktreeBase = join(projectTac, "worktrees", "M008");
    mkdirSync(worktreeBase, { recursive: true });
    // NOTE: no .tac/ inside worktreeBase

    const result = tacRoot(worktreeBase);
    const expected = join(worktreeBase, ".tac");

    // Without the fix, this returns projectTac (/project/.tac) because the
    // walk-up from worktreeBase finds it. With the fix, it returns the
    // worktree-local path.
    assert.notEqual(
      result,
      projectTac,
      "tacRoot() must NOT return the project root .tac when basePath is inside .tac/worktrees/",
    );
    assert.equal(
      result,
      expected,
      `Expected worktree-local .tac (${expected}), got ${result}.`,
    );
  });

  test("returns worktree .tac when basePath is a real git worktree inside .tac/worktrees/", () => {
    // Create a real git worktree at .tac/worktrees/M010
    const worktreeName = "M010";
    const worktreeBase = join(projectTac, "worktrees", worktreeName);

    // Use git worktree add to create a real worktree
    const result = spawnSync(
      "git",
      ["worktree", "add", "-b", `milestone/${worktreeName}`, worktreeBase],
      { cwd: projectRoot, encoding: "utf-8" },
    );

    if (result.status !== 0) {
      // If git worktree add fails, skip the test gracefully
      assert.ok(true, "Skipped: git worktree add not available");
      return;
    }

    // The real git worktree exists at worktreeBase but has NO .tac/ subdir yet
    const tacResult = tacRoot(worktreeBase);
    const expected = join(worktreeBase, ".tac");

    assert.notEqual(
      tacResult,
      projectTac,
      "tacRoot() must NOT escape to project root .tac from inside a git worktree",
    );
    assert.equal(
      tacResult,
      expected,
      `Expected worktree-local .tac (${expected}), got ${tacResult}`,
    );

    // Cleanup worktree
    spawnSync("git", ["worktree", "remove", "--force", worktreeBase], {
      cwd: projectRoot,
      stdio: "ignore",
    });
  });

  test("still returns project .tac for normal (non-worktree) basePath", () => {
    const result = tacRoot(projectRoot);
    assert.equal(result, projectTac);
  });

  test("still returns project .tac for a subdirectory of the project", () => {
    const subdir = join(projectRoot, "src", "lib");
    mkdirSync(subdir, { recursive: true });

    const result = tacRoot(subdir);
    assert.equal(
      result,
      projectTac,
      "Non-worktree subdirectories should still resolve to project .tac",
    );
  });
});
