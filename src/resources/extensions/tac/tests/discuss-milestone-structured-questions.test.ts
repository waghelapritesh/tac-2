import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { resolveDispatch, type DispatchContext } from "../auto-dispatch.ts";
import type { TACState } from "../types.ts";

function makeState(phase: TACState["phase"]): TACState {
  return {
    activeMilestone: { id: "M001", title: "Structured Questions" },
    activeSlice: null,
    activeTask: null,
    phase,
    recentDecisions: [],
    blockers: [],
    nextAction: "",
    registry: [],
  };
}

function makeContext(
  basePath: string,
  phase: TACState["phase"],
  structuredQuestionsAvailable: "true" | "false",
): DispatchContext {
  return {
    basePath,
    mid: "M001",
    midTitle: "Structured Questions",
    state: makeState(phase),
    prefs: undefined,
    structuredQuestionsAvailable,
  };
}

test("auto-dispatch passes structuredQuestionsAvailable=true into discuss-milestone prompt", async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "tac-discuss-milestone-structured-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  const result = await resolveDispatch(makeContext(tmp, "needs-discussion", "true"));

  assert.equal(result.action, "dispatch");
  assert.equal(result.unitType, "discuss-milestone");
  assert.match(
    result.prompt,
    /\*\*Structured questions available: true\*\*/,
  );
});

test("auto-dispatch preserves structuredQuestionsAvailable=false for discuss-milestone prompt", async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "tac-discuss-milestone-plain-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  const result = await resolveDispatch(makeContext(tmp, "pre-planning", "false"));

  assert.equal(result.action, "dispatch");
  assert.equal(result.unitType, "discuss-milestone");
  assert.match(
    result.prompt,
    /\*\*Structured questions available: false\*\*/,
  );
});
