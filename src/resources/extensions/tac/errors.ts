/**
 * TAC Error Types — Typed error hierarchy for diagnostics and crash recovery.
 *
 * All TAC-specific errors extend TACError, which carries a stable `code`
 * string suitable for programmatic matching. Error codes are defined as
 * constants so callers can switch on them without string-matching.
 */

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const TAC_STALE_STATE = "TAC_STALE_STATE";
export const TAC_LOCK_HELD = "TAC_LOCK_HELD";
export const TAC_ARTIFACT_MISSING = "TAC_ARTIFACT_MISSING";
export const TAC_GIT_ERROR = "TAC_GIT_ERROR";
export const TAC_MERGE_CONFLICT = "TAC_MERGE_CONFLICT";
export const TAC_PARSE_ERROR = "TAC_PARSE_ERROR";
export const TAC_IO_ERROR = "TAC_IO_ERROR";

// ─── Base Error ───────────────────────────────────────────────────────────────

export class TACError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TACError";
    this.code = code;
  }
}
