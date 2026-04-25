import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
	activateTAC,
	deactivateTAC,
	setCurrentPhase,
	clearCurrentPhase,
	isTACActive,
	getCurrentPhase,
} from "../tac-phase-state.js";

describe("tac-phase-state", () => {
	beforeEach(() => {
		deactivateTAC();
	});

	it("tracks active/inactive state", () => {
		assert.equal(isTACActive(), false);
		activateTAC();
		assert.equal(isTACActive(), true);
		deactivateTAC();
		assert.equal(isTACActive(), false);
	});

	it("tracks the current phase when active", () => {
		activateTAC();
		assert.equal(getCurrentPhase(), null);
		setCurrentPhase("plan-milestone");
		assert.equal(getCurrentPhase(), "plan-milestone");
		clearCurrentPhase();
		assert.equal(getCurrentPhase(), null);
	});

	it("returns null phase when inactive even if phase was set", () => {
		activateTAC();
		setCurrentPhase("plan-milestone");
		deactivateTAC();
		assert.equal(getCurrentPhase(), null);
	});

	it("deactivation clears the current phase", () => {
		activateTAC();
		setCurrentPhase("execute-task");
		deactivateTAC();
		activateTAC();
		assert.equal(getCurrentPhase(), null);
	});
});
