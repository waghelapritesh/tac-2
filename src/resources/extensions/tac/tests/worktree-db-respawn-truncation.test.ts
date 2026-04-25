/**
 * worktree-db-respawn-truncation.test.ts — Regression test for #2815.
 *
 * Verifies that syncProjectRootToWorktree does NOT delete a non-empty
 * worktree tac.db. On worker respawn, tac-migrate populates the DB
 * (~1.7MB) before the auto-loop calls syncProjectRootToWorktree. The
 * sync step must preserve the freshly-migrated DB to avoid truncating
 * it to 0 bytes and causing "no such table: slices" failures.
 *
 * Covers:
 *   - Non-empty worktree tac.db preserved after sync (#2815)
 *   - Empty (0-byte) worktree tac.db still deleted (#853 preserved)
 *   - WAL/SHM sidecar files cleaned up when empty DB is deleted
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { syncProjectRootToWorktree } from '../auto-worktree.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';


function createBase(name: string): string {
  const base = mkdtempSync(join(tmpdir(), `tac-wt-respawn-${name}-`));
  mkdirSync(join(base, '.tac', 'milestones'), { recursive: true });
  return base;
}

function cleanup(base: string): void {
  rmSync(base, { recursive: true, force: true });
}

describe('worktree-db-respawn-truncation (#2815)', async () => {

  // ─── 1. Non-empty worktree tac.db preserved after sync ───────────────
  console.log('\n=== 1. non-empty worktree tac.db preserved after sync (#2815) ===');
  {
    const mainBase = createBase('main');
    const wtBase = createBase('wt');

    try {
      // Set up milestone artifacts in main project root
      const m001Dir = join(mainBase, '.tac', 'milestones', 'M001');
      mkdirSync(m001Dir, { recursive: true });
      writeFileSync(join(m001Dir, 'M001-ROADMAP.md'), '# Roadmap');

      // Simulate a freshly-migrated worktree DB (non-empty, like after tac-migrate)
      // Real DBs are ~1.7MB; we use a smaller payload to prove the size check works
      const fakeDbContent = Buffer.alloc(4096, 0x42); // 4KB non-empty DB
      writeFileSync(join(wtBase, '.tac', 'tac.db'), fakeDbContent);

      const sizeBefore = statSync(join(wtBase, '.tac', 'tac.db')).size;
      assert.ok(sizeBefore > 0, 'tac.db is non-empty before sync');

      syncProjectRootToWorktree(mainBase, wtBase, 'M001');

      // The non-empty DB must survive the sync
      assert.ok(
        existsSync(join(wtBase, '.tac', 'tac.db')),
        '#2815: non-empty tac.db must not be deleted by sync',
      );
      const sizeAfter = statSync(join(wtBase, '.tac', 'tac.db')).size;
      assert.equal(
        sizeAfter,
        sizeBefore,
        '#2815: tac.db size must be unchanged after sync',
      );
    } finally {
      cleanup(mainBase);
      cleanup(wtBase);
    }
  }

  // ─── 2. Empty (0-byte) worktree tac.db still deleted ─────────────────
  console.log('\n=== 2. empty (0-byte) worktree tac.db still deleted (#853) ===');
  {
    const mainBase = createBase('main');
    const wtBase = createBase('wt');

    try {
      const m001Dir = join(mainBase, '.tac', 'milestones', 'M001');
      mkdirSync(m001Dir, { recursive: true });
      writeFileSync(join(m001Dir, 'M001-ROADMAP.md'), '# Roadmap');

      // Create an empty (0-byte) tac.db — this is stale/corrupt and should be deleted
      writeFileSync(join(wtBase, '.tac', 'tac.db'), '');
      assert.ok(existsSync(join(wtBase, '.tac', 'tac.db')), 'empty tac.db exists before sync');

      syncProjectRootToWorktree(mainBase, wtBase, 'M001');

      assert.ok(
        !existsSync(join(wtBase, '.tac', 'tac.db')),
        '#853: empty tac.db must still be deleted after sync',
      );
    } finally {
      cleanup(mainBase);
      cleanup(wtBase);
    }
  }

  // ─── 3. WAL/SHM sidecar files cleaned up when empty DB is deleted (#2478) ──
  console.log('\n=== 3. orphaned WAL/SHM cleaned up alongside empty tac.db (#2478) ===');
  {
    const mainBase = createBase('main');
    const wtBase = createBase('wt');

    try {
      const m001Dir = join(mainBase, '.tac', 'milestones', 'M001');
      mkdirSync(m001Dir, { recursive: true });
      writeFileSync(join(m001Dir, 'M001-ROADMAP.md'), '# Roadmap');

      // Create an empty (0-byte) tac.db plus orphaned WAL and SHM files —
      // this is the exact state that causes Node 24 node:sqlite CPU spin (#2478).
      const wtTac = join(wtBase, '.tac');
      writeFileSync(join(wtTac, 'tac.db'), '');
      writeFileSync(join(wtTac, 'tac.db-wal'), Buffer.alloc(605672, 0xAA));
      writeFileSync(join(wtTac, 'tac.db-shm'), Buffer.alloc(32768, 0xBB));

      assert.ok(existsSync(join(wtTac, 'tac.db')), 'tac.db exists before sync');
      assert.ok(existsSync(join(wtTac, 'tac.db-wal')), 'tac.db-wal exists before sync');
      assert.ok(existsSync(join(wtTac, 'tac.db-shm')), 'tac.db-shm exists before sync');

      syncProjectRootToWorktree(mainBase, wtBase, 'M001');

      assert.ok(
        !existsSync(join(wtTac, 'tac.db')),
        '#2478: empty tac.db must be deleted',
      );
      assert.ok(
        !existsSync(join(wtTac, 'tac.db-wal')),
        '#2478: orphaned tac.db-wal must be deleted alongside tac.db',
      );
      assert.ok(
        !existsSync(join(wtTac, 'tac.db-shm')),
        '#2478: orphaned tac.db-shm must be deleted alongside tac.db',
      );
    } finally {
      cleanup(mainBase);
      cleanup(wtBase);
    }
  }

  // ─── 4. Orphaned WAL/SHM cleaned up even when tac.db already missing (#2478) ──
  console.log('\n=== 4. orphaned WAL/SHM cleaned up even without tac.db (#2478) ===');
  {
    const mainBase = createBase('main');
    const wtBase = createBase('wt');

    try {
      const m001Dir = join(mainBase, '.tac', 'milestones', 'M001');
      mkdirSync(m001Dir, { recursive: true });
      writeFileSync(join(m001Dir, 'M001-ROADMAP.md'), '# Roadmap');

      // Orphaned WAL/SHM with NO tac.db at all — can happen from a previous
      // partial cleanup. These must still be cleaned up.
      const wtTac = join(wtBase, '.tac');
      writeFileSync(join(wtTac, 'tac.db-wal'), Buffer.alloc(1024, 0xAA));
      writeFileSync(join(wtTac, 'tac.db-shm'), Buffer.alloc(1024, 0xBB));

      assert.ok(!existsSync(join(wtTac, 'tac.db')), 'tac.db does not exist');
      assert.ok(existsSync(join(wtTac, 'tac.db-wal')), 'orphaned tac.db-wal exists');
      assert.ok(existsSync(join(wtTac, 'tac.db-shm')), 'orphaned tac.db-shm exists');

      syncProjectRootToWorktree(mainBase, wtBase, 'M001');

      assert.ok(
        !existsSync(join(wtTac, 'tac.db-wal')),
        '#2478: orphaned tac.db-wal must be deleted even without main db file',
      );
      assert.ok(
        !existsSync(join(wtTac, 'tac.db-shm')),
        '#2478: orphaned tac.db-shm must be deleted even without main db file',
      );
    } finally {
      cleanup(mainBase);
      cleanup(wtBase);
    }
  }

  // ─── 5. Milestone artifacts still synced when DB is preserved ────────
  console.log('\n=== 5. milestone artifacts still synced even when DB preserved ===');
  {
    const mainBase = createBase('main');
    const wtBase = createBase('wt');

    try {
      const m001Dir = join(mainBase, '.tac', 'milestones', 'M001');
      mkdirSync(m001Dir, { recursive: true });
      writeFileSync(join(m001Dir, 'M001-ROADMAP.md'), '# Roadmap');
      mkdirSync(join(m001Dir, 'slices', 'S01'), { recursive: true });
      writeFileSync(join(m001Dir, 'slices', 'S01', 'S01-PLAN.md'), '# Plan');

      // Non-empty DB in worktree
      writeFileSync(join(wtBase, '.tac', 'tac.db'), 'populated-db-data');

      syncProjectRootToWorktree(mainBase, wtBase, 'M001');

      // Artifacts must still be synced
      assert.ok(
        existsSync(join(wtBase, '.tac', 'milestones', 'M001', 'M001-ROADMAP.md')),
        'milestone artifacts synced even with preserved DB',
      );
      assert.ok(
        existsSync(join(wtBase, '.tac', 'milestones', 'M001', 'slices', 'S01', 'S01-PLAN.md')),
        'slice artifacts synced even with preserved DB',
      );
      // DB must still exist
      assert.ok(
        existsSync(join(wtBase, '.tac', 'tac.db')),
        '#2815: DB preserved alongside artifact sync',
      );
    } finally {
      cleanup(mainBase);
      cleanup(wtBase);
    }
  }
});
