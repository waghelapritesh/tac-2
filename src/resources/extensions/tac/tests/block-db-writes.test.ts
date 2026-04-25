/**
 * Regression test for #3674 — block direct writes to tac.db
 *
 * When tac_complete_task was unavailable, agents fell back to shell-based
 * sqlite3 writes, corrupting the WAL-backed database. The fix extends
 * write-intercept to block file writes and bash commands targeting tac.db.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedStateFile, isBashWriteToStateFile } from '../write-intercept.ts';

describe('isBlockedStateFile blocks tac.db paths (#3674)', () => {
  test('blocks .tac/tac.db', () => {
    assert.ok(isBlockedStateFile('/project/.tac/tac.db'));
  });

  test('blocks .tac/tac.db-wal', () => {
    assert.ok(isBlockedStateFile('/project/.tac/tac.db-wal'));
  });

  test('blocks .tac/tac.db-shm', () => {
    assert.ok(isBlockedStateFile('/project/.tac/tac.db-shm'));
  });

  test('blocks resolved symlink path under .tac/projects/', () => {
    assert.ok(isBlockedStateFile('/home/user/.tac/projects/myproj/tac.db'));
  });

  test('still blocks STATE.md', () => {
    assert.ok(isBlockedStateFile('/project/.tac/STATE.md'));
  });

  test('does not block other .tac files', () => {
    assert.ok(!isBlockedStateFile('/project/.tac/DECISIONS.md'));
  });
});

describe('isBashWriteToStateFile blocks DB shell commands (#3674)', () => {
  test('blocks sqlite3 targeting tac.db', () => {
    assert.ok(isBashWriteToStateFile('sqlite3 .tac/tac.db "INSERT INTO ..."'));
  });

  test('blocks better-sqlite3 targeting tac.db', () => {
    assert.ok(isBashWriteToStateFile('node -e "require(\'better-sqlite3\')(\'.tac/tac.db\')"'));
  });

  test('blocks shell redirect to tac.db', () => {
    assert.ok(isBashWriteToStateFile('echo data > .tac/tac.db'));
  });

  test('blocks cp to tac.db', () => {
    assert.ok(isBashWriteToStateFile('cp backup.db .tac/tac.db'));
  });

  test('blocks mv to tac.db', () => {
    assert.ok(isBashWriteToStateFile('mv temp.db .tac/tac.db'));
  });

  test('does not block reading tac.db with cat', () => {
    assert.ok(!isBashWriteToStateFile('cat .tac/tac.db'));
  });
});
