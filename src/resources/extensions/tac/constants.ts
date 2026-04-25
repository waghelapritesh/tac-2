/**
 * TAC Extension — Shared Constants
 *
 * Centralized timeout and cache-size constants used across the TAC extension.
 */

// ─── Timeouts ─────────────────────────────────────────────────────────────────

/** Default timeout for verification-gate commands (ms). */
export const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;

/** Default timeout for the dynamic bash tool (seconds). */
export const DEFAULT_BASH_TIMEOUT_SECS = 120;

// ─── Cache Sizes ──────────────────────────────────────────────────────────────

/** Max directory-listing cache entries before eviction (#611). */
export const DIR_CACHE_MAX = 200;

/** Max parse-cache entries before eviction. */
export const CACHE_MAX = 50;

// ─── Tool Scoping ─────────────────────────────────────────────────────────────

/**
 * TAC tools allowed during discuss flows (#2949).
 *
 * xAI/Grok (and potentially other providers with grammar-based constrained
 * decoding) return "Grammar is too complex" (HTTP 400) when the combined
 * tool schemas exceed their internal grammar limit. The full TAC tool set
 * registers ~33 tools with deeply nested schemas; discuss flows only need
 * a small subset.
 *
 * By scoping tools to this allowlist during discuss dispatches, the grammar
 * sent to the provider stays well under provider limits.
 *
 * Included tools and why:
 *   - tac_summary_save: writes CONTEXT.md artifacts (all discuss prompts)
 *   - tac_save_summary: alias for above
 *   - tac_decision_save: records decisions (discuss.md output phase)
 *   - tac_save_decision: alias for above
 *   - tac_plan_milestone: writes roadmap (discuss.md single/multi milestone)
 *   - tac_milestone_plan: alias for above
 *   - tac_milestone_generate_id: generates milestone IDs (discuss.md multi-milestone)
 *   - tac_generate_milestone_id: alias for above
 *   - tac_requirement_update: updates requirements during discuss
 *   - tac_update_requirement: alias for above
 */
export const DISCUSS_TOOLS_ALLOWLIST: readonly string[] = [
  // Context / summary writing
  "tac_summary_save",
  "tac_save_summary",
  // Decision recording
  "tac_decision_save",
  "tac_save_decision",
  // Milestone planning (needed for discuss.md output phase)
  "tac_plan_milestone",
  "tac_milestone_plan",
  // Milestone ID generation (multi-milestone flow)
  "tac_milestone_generate_id",
  "tac_generate_milestone_id",
  // Requirement updates
  "tac_requirement_update",
  "tac_update_requirement",
];
