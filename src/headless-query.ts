/**
 * Headless Query — `tac headless query`
 *
 * Single read-only command that returns the full project snapshot as JSON
 * to stdout, without spawning an LLM session. Instant (~50ms).
 *
 * Output: { state, next, cost }
 *   state — deriveState() output (phase, milestones, progress, blockers)
 *   next  — dry-run dispatch preview (what auto-mode would do next)
 *   cost  — aggregated parallel worker costs
 *
 * Note: Extension modules are .ts files loaded via jiti (not compiled to .js).
 * We use createJiti() here because this module is imported directly from cli.ts,
 * bypassing the extension loader's jiti setup (#1137).
 */

import { createJiti } from '@mariozechner/jiti'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { TACState } from './resources/extensions/tac/types.js'
import { resolveBundledSourceResource } from './bundled-resource-path.js'

const jiti = createJiti(fileURLToPath(import.meta.url), { interopDefault: true, debug: false })
// Resolve extensions from the synced agent directory so headless-query
// loads the same extension copy as interactive/auto modes (#3471).
// Falls back to bundled source for source-tree dev workflows.
const agentExtensionsDir = join(process.env.TAC_AGENT_DIR || join(homedir(), '.tac', 'agent'), 'extensions', 'tac')
const { existsSync } = await import('node:fs')
const useAgentDir = existsSync(join(agentExtensionsDir, 'state.ts'))
const tacExtensionPath = (...segments: string[]) =>
  useAgentDir
    ? join(agentExtensionsDir, ...segments)
    : resolveBundledSourceResource(import.meta.url, 'extensions', 'tac', ...segments)

async function loadExtensionModules() {
  const stateModule = await jiti.import(tacExtensionPath('state.ts'), {}) as any
  const dispatchModule = await jiti.import(tacExtensionPath('auto-dispatch.ts'), {}) as any
  const sessionModule = await jiti.import(tacExtensionPath('session-status-io.ts'), {}) as any
  const prefsModule = await jiti.import(tacExtensionPath('preferences.ts'), {}) as any
  const autoStartModule = await jiti.import(tacExtensionPath('auto-start.ts'), {}) as any
  return {
    openProjectDbIfPresent: autoStartModule.openProjectDbIfPresent as (basePath: string) => Promise<void>,
    deriveState: stateModule.deriveState as (basePath: string) => Promise<TACState>,
    resolveDispatch: dispatchModule.resolveDispatch as (opts: any) => Promise<any>,
    readAllSessionStatuses: sessionModule.readAllSessionStatuses as (basePath: string) => any[],
    loadEffectiveTACPreferences: prefsModule.loadEffectiveTACPreferences as () => any,
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuerySnapshot {
  state: TACState
  next: {
    action: 'dispatch' | 'stop' | 'skip'
    unitType?: string
    unitId?: string
    reason?: string
  }
  cost: {
    workers: Array<{
      milestoneId: string
      pid: number
      state: string
      cost: number
      lastHeartbeat: number
    }>
    total: number
  }
}

export interface QueryResult {
  exitCode: number
  data?: QuerySnapshot
}

// ─── Implementation ─────────────────────────────────────────────────────────

export async function handleQuery(basePath: string): Promise<QueryResult> {
  const {
    openProjectDbIfPresent,
    deriveState,
    resolveDispatch,
    readAllSessionStatuses,
    loadEffectiveTACPreferences,
  } = await loadExtensionModules()
  await openProjectDbIfPresent(basePath)
  const state = await deriveState(basePath)

  // Derive next dispatch action
  let next: QuerySnapshot['next']
  if (!state.activeMilestone?.id) {
    next = {
      action: 'stop',
      reason: state.phase === 'complete' ? 'All milestones complete.' : state.nextAction,
    }
  } else {
    const loaded = loadEffectiveTACPreferences()
    const dispatch = await resolveDispatch({
      basePath,
      mid: state.activeMilestone.id,
      midTitle: state.activeMilestone.title,
      state,
      prefs: loaded?.preferences,
    })
    next = {
      action: dispatch.action,
      unitType: dispatch.action === 'dispatch' ? dispatch.unitType : undefined,
      unitId: dispatch.action === 'dispatch' ? dispatch.unitId : undefined,
      reason: dispatch.action === 'stop' ? dispatch.reason : undefined,
    }
  }

  // Aggregate parallel worker costs
  const statuses = readAllSessionStatuses(basePath)
  const workers = statuses.map((s) => ({
    milestoneId: s.milestoneId,
    pid: s.pid,
    state: s.state,
    cost: s.cost,
    lastHeartbeat: s.lastHeartbeat,
  }))

  const snapshot: QuerySnapshot = {
    state,
    next,
    cost: { workers, total: workers.reduce((sum, w) => sum + w.cost, 0) },
  }

  process.stdout.write(JSON.stringify(snapshot) + '\n')
  return { exitCode: 0, data: snapshot }
}
