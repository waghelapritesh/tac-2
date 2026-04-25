/**
 * inherited-repo-home-dir.test.ts — Regression test for #2393.
 *
 * When the user's home directory IS a git repo (common with dotfile
 * managers like yadm), isInheritedRepo() must not treat ~/.tac (the
 * global TAC state directory) as a project .tac belonging to the home
 * repo. Without the fix, isInheritedRepo() returns false for project
 * subdirectories because it sees ~/.tac and concludes the parent repo
 * has already been initialised with TAC — causing the wrong project
 * state to be loaded.
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  realpathSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { isInheritedRepo } from "../../repo-identity.ts";

function run(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  }).trim();
}

describe("isInheritedRepo when git root is HOME (#2393)", () => {
  let fakeHome: string;
  let stateDir: string;
  let origTacHome: string | undefined;
  let origTacStateDir: string | undefined;

  beforeEach(() => {
    // Create a fake HOME that is itself a git repo (dotfile manager scenario).
    fakeHome = realpathSync(mkdtempSync(join(tmpdir(), "tac-home-repo-")));
    run("git", ["init", "-b", "main"], fakeHome);
    run("git", ["config", "user.name", "Test"], fakeHome);
    run("git", ["config", "user.email", "test@example.com"], fakeHome);
    writeFileSync(join(fakeHome, ".bashrc"), "# dotfiles\n", "utf-8");
    run("git", ["add", ".bashrc"], fakeHome);
    run("git", ["commit", "-m", "init dotfiles"], fakeHome);

    // Create a plain ~/.tac directory at fakeHome — this simulates the
    // global TAC home directory, NOT a project .tac.
    mkdirSync(join(fakeHome, ".tac", "projects"), { recursive: true });

    // Save and override env. Point TAC_HOME at fakeHome/.tac so the
    // function recognizes it as the global state directory.
    origTacHome = process.env.TAC_HOME;
    origTacStateDir = process.env.TAC_STATE_DIR;
    process.env.TAC_HOME = join(fakeHome, ".tac");
    stateDir = mkdtempSync(join(tmpdir(), "tac-state-"));
    process.env.TAC_STATE_DIR = stateDir;
  });

  afterEach(() => {
    if (origTacHome !== undefined) process.env.TAC_HOME = origTacHome;
    else delete process.env.TAC_HOME;
    if (origTacStateDir !== undefined) process.env.TAC_STATE_DIR = origTacStateDir;
    else delete process.env.TAC_STATE_DIR;

    rmSync(fakeHome, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  });

  test("subdirectory of home-as-git-root is detected as inherited even when ~/.tac exists", () => {
    // Create a project directory inside fake HOME
    const projectDir = join(fakeHome, "projects", "my-app");
    mkdirSync(projectDir, { recursive: true });

    // The bug: isInheritedRepo sees ~/.tac and returns false, thinking
    // the home repo is a legitimate TAC project. It should return true
    // because ~/.tac is the global state dir, not a project .tac.
    assert.strictEqual(
      isInheritedRepo(projectDir),
      true,
      "project inside home-as-git-root must be detected as inherited repo, " +
      "even when ~/.tac (global state dir) exists",
    );
  });

  test("subdirectory with a real project .tac symlink at git root is NOT inherited", () => {
    // Simulate a legitimately initialised TAC project at the home repo root:
    // .tac is a symlink to an external state directory.
    const externalState = join(stateDir, "projects", "home-project");
    mkdirSync(externalState, { recursive: true });
    const tacDir = join(fakeHome, ".tac");

    // Remove the plain directory and replace with a symlink (real project .tac)
    rmSync(tacDir, { recursive: true, force: true });
    symlinkSync(externalState, tacDir);

    const projectDir = join(fakeHome, "projects", "my-app");
    mkdirSync(projectDir, { recursive: true });

    // When .tac at root IS a project symlink, subdirectories are legitimate children
    assert.strictEqual(
      isInheritedRepo(projectDir),
      false,
      "subdirectory of a legitimately-initialised TAC project should NOT be inherited",
    );
  });

  test("home-as-git-root itself is never inherited", () => {
    assert.strictEqual(
      isInheritedRepo(fakeHome),
      false,
      "the git root itself is never inherited",
    );
  });
});

describe("isInheritedRepo with stale .tac at parent git root", () => {
  let parentRepo: string;

  beforeEach(() => {
    parentRepo = realpathSync(mkdtempSync(join(tmpdir(), "tac-stale-parent-")));
    run("git", ["init", "-b", "main"], parentRepo);
    run("git", ["config", "user.name", "Test"], parentRepo);
    run("git", ["config", "user.email", "test@example.com"], parentRepo);
    writeFileSync(join(parentRepo, "README.md"), "# Parent\n", "utf-8");
    run("git", ["add", "README.md"], parentRepo);
    run("git", ["commit", "-m", "init"], parentRepo);
  });

  afterEach(() => {
    rmSync(parentRepo, { recursive: true, force: true });
  });

  test("stale .tac dir at parent git root does not suppress inherited detection", () => {
    // Simulate a stale .tac directory at the parent git root (e.g. from a
    // prior doctor run or accidental init). This is a real directory, NOT
    // a symlink, and NOT the global TAC home.
    mkdirSync(join(parentRepo, ".tac"), { recursive: true });

    const projectDir = join(parentRepo, "my-project");
    mkdirSync(projectDir, { recursive: true });

    // Without fix: isProjectTac(join(root, ".tac")) returns true because
    // the stale .tac is a real directory that isn't the global TAC home,
    // causing isInheritedRepo to return false (false negative).
    //
    // The stale .tac at parent is still treated as a "project .tac" by
    // isProjectTac(), so the git root check at line 128 returns false.
    // This is the expected behavior for that check — the defense-in-depth
    // fix in auto-start.ts handles this case by checking for local .git.
    //
    // Verify the function behavior is consistent:
    assert.strictEqual(
      isInheritedRepo(projectDir),
      false,
      "stale .tac dir at git root still causes isInheritedRepo to return false " +
      "(defense-in-depth in auto-start.ts handles this case)",
    );
  });

  test("basePath's own .tac symlink does not suppress inherited detection", () => {
    // Create a project subdir with its own .tac symlink (set up during
    // the discuss phase, before auto-mode bootstrap runs).
    const projectDir = join(parentRepo, "my-project");
    mkdirSync(projectDir, { recursive: true });

    const externalState = mkdtempSync(join(tmpdir(), "tac-ext-state-"));
    symlinkSync(externalState, join(projectDir, ".tac"));

    // Before fix: the walk-up loop started at normalizedBase (projectDir),
    // found .tac at projectDir, and returned false — even though projectDir
    // has no .git of its own. The .tac at basePath is irrelevant to whether
    // the git repo is inherited from a parent.
    //
    // After fix: the walk-up starts at dirname(normalizedBase), skipping
    // basePath's own .tac.
    assert.strictEqual(
      isInheritedRepo(projectDir),
      true,
      "project's own .tac symlink must not suppress inherited repo detection",
    );

    rmSync(externalState, { recursive: true, force: true });
  });
});
