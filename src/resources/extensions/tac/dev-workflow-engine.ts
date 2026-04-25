/**
 * dev-workflow-engine.ts — DevWorkflowEngine implementation.
 *
 * Implements WorkflowEngine by delegating to existing TAC state derivation
 * and dispatch logic. This is the "dev" engine — it wraps the current TAC
 * auto-mode behavior behind the engine-polymorphic interface.
 */

import type { WorkflowEngine } from "./workflow-engine.js";
import type {
  EngineState,
  EngineDispatchAction,
  CompletedStep,
  ReconcileResult,
  DisplayMetadata,
} from "./engine-types.js";
import type { TACState } from "./types.js";
import type { DispatchAction, DispatchContext } from "./auto-dispatch.js";

import { deriveState } from "./state.js";
import { resolveDispatch } from "./auto-dispatch.js";
import { loadEffectiveTACPreferences } from "./preferences.js";

// ─── Bridge: DispatchAction → EngineDispatchAction ────────────────────────

/**
 * Map a TAC-specific DispatchAction (which carries `matchedRule`, `unitType`,
 * etc.) to the engine-generic EngineDispatchAction discriminated union.
 *
 * Exported for unit testing.
 */
export function bridgeDispatchAction(da: DispatchAction): EngineDispatchAction {
  switch (da.action) {
    case "dispatch":
      return {
        action: "dispatch",
        step: {
          unitType: da.unitType,
          unitId: da.unitId,
          prompt: da.prompt,
        },
      };
    case "stop":
      return {
        action: "stop",
        reason: da.reason,
        level: da.level,
      };
    case "skip":
      return { action: "skip" };
  }
}

// ─── DevWorkflowEngine ───────────────────────────────────────────────────

export class DevWorkflowEngine implements WorkflowEngine {
  readonly engineId = "dev" as const;

  async deriveState(basePath: string): Promise<EngineState> {
    const tac: TACState = await deriveState(basePath);
    return {
      phase: tac.phase,
      currentMilestoneId: tac.activeMilestone?.id ?? null,
      activeSliceId: tac.activeSlice?.id ?? null,
      activeTaskId: tac.activeTask?.id ?? null,
      isComplete: tac.phase === "complete",
      raw: tac,
    };
  }

  async resolveDispatch(
    state: EngineState,
    context: { basePath: string },
  ): Promise<EngineDispatchAction> {
    const tac = state.raw as TACState;
    const mid = tac.activeMilestone?.id ?? "";
    const midTitle = tac.activeMilestone?.title ?? "";
    const loaded = loadEffectiveTACPreferences();
    const prefs = loaded?.preferences ?? undefined;

    const dispatchCtx: DispatchContext = {
      basePath: context.basePath,
      mid,
      midTitle,
      state: tac,
      prefs,
    };

    const result = await resolveDispatch(dispatchCtx);
    return bridgeDispatchAction(result);
  }

  async reconcile(
    state: EngineState,
    _completedStep: CompletedStep,
  ): Promise<ReconcileResult> {
    return {
      outcome: state.isComplete ? "milestone-complete" : "continue",
    };
  }

  getDisplayMetadata(state: EngineState): DisplayMetadata {
    return {
      engineLabel: "TAC Dev",
      currentPhase: state.phase,
      progressSummary: `${state.currentMilestoneId ?? "no milestone"} / ${state.activeSliceId ?? "—"} / ${state.activeTaskId ?? "—"}`,
      stepCount: null,
    };
  }
}
