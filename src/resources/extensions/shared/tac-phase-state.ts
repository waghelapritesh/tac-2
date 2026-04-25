/**
 * TAC Phase State — cross-extension coordination
 * Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
 *
 * Lightweight module-level state that TAC auto-mode writes to and the
 * subagent tool reads from. Both extensions run in the same process so
 * a module variable is sufficient — no file I/O needed.
 */

let _active = false;
let _currentPhase: string | null = null;

/** Mark TAC auto-mode as active. */
export function activateTAC(): void {
	_active = true;
}

/** Mark TAC auto-mode as inactive and clear the current phase. */
export function deactivateTAC(): void {
	_active = false;
	_currentPhase = null;
}

/** Set the currently dispatched TAC phase (e.g. "plan-milestone"). */
export function setCurrentPhase(phase: string): void {
	_currentPhase = phase;
}

/** Clear the current phase (unit completed or aborted). */
export function clearCurrentPhase(): void {
	_currentPhase = null;
}

/** Returns true if TAC auto-mode is currently active. */
export function isTACActive(): boolean {
	return _active;
}

/** Returns the current TAC phase, or null if none is active. */
export function getCurrentPhase(): string | null {
	return _active ? _currentPhase : null;
}
