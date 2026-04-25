import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	AssistantMessageEventStream,
	createAssistantMessageEventStream,
} from "@tac/pi-ai";

describe("@tac/pi-ai event stream exports", () => {
	it("exports createAssistantMessageEventStream for package consumers", () => {
		assert.equal(typeof createAssistantMessageEventStream, "function");
		const stream = createAssistantMessageEventStream();
		assert.ok(stream instanceof AssistantMessageEventStream);
	});
});
