// TAC Extension — write-intercept unit tests
// Tests isBlockedStateFile() and BLOCKED_WRITE_ERROR constant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedStateFile, BLOCKED_WRITE_ERROR } from '../write-intercept.ts';

// ─── isBlockedStateFile: blocked paths ───────────────────────────────────

test('write-intercept: blocks unix .tac/STATE.md path', () => {
  assert.strictEqual(isBlockedStateFile('/project/.tac/STATE.md'), true);
});

test('write-intercept: blocks relative path with dir prefix before .tac/STATE.md', () => {
  assert.strictEqual(isBlockedStateFile('project/.tac/STATE.md'), true);
});

test('write-intercept: blocks bare relative .tac/STATE.md (no leading separator)', () => {
  // (^|[/\\]) matches paths that start with .tac/ — covers the case where write
  // tools receive a bare relative path before the file exists (realpathSync fails).
  assert.strictEqual(isBlockedStateFile('.tac/STATE.md'), true);
});

test('write-intercept: blocks nested project .tac/STATE.md path', () => {
  assert.strictEqual(isBlockedStateFile('/Users/dev/my-project/.tac/STATE.md'), true);
});

test('write-intercept: blocks .tac/projects/<name>/STATE.md (symlinked projects path)', () => {
  assert.strictEqual(isBlockedStateFile('/home/user/.tac/projects/my-project/STATE.md'), true);
});

// ─── isBlockedStateFile: allowed paths ───────────────────────────────────

test('write-intercept: allows .tac/ROADMAP.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.tac/ROADMAP.md'), false);
});

test('write-intercept: allows .tac/PLAN.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.tac/PLAN.md'), false);
});

test('write-intercept: allows .tac/REQUIREMENTS.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.tac/REQUIREMENTS.md'), false);
});

test('write-intercept: allows .tac/SUMMARY.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.tac/SUMMARY.md'), false);
});

test('write-intercept: allows .tac/PROJECT.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.tac/PROJECT.md'), false);
});

test('write-intercept: allows regular source files', () => {
  assert.strictEqual(isBlockedStateFile('/project/src/index.ts'), false);
});

test('write-intercept: allows slice plan files', () => {
  assert.strictEqual(isBlockedStateFile('/project/.tac/milestones/M001/slices/S01/S01-PLAN.md'), false);
});

test('write-intercept: does not block files named STATE.md outside .tac/', () => {
  assert.strictEqual(isBlockedStateFile('/project/docs/STATE.md'), false);
});

// ─── BLOCKED_WRITE_ERROR: content ────────────────────────────────────────

test('write-intercept: BLOCKED_WRITE_ERROR is a non-empty string', () => {
  assert.strictEqual(typeof BLOCKED_WRITE_ERROR, 'string');
  assert.ok(BLOCKED_WRITE_ERROR.length > 0);
});

test('write-intercept: BLOCKED_WRITE_ERROR mentions engine tool calls', () => {
  assert.ok(BLOCKED_WRITE_ERROR.includes('tac_complete_task'), 'should mention tac_complete_task');
  assert.ok(BLOCKED_WRITE_ERROR.includes('engine tool calls'), 'should mention engine tool calls');
});
