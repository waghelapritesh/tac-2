import test from "node:test";
import assert from "node:assert/strict";

import { registerTACCommand } from "../commands.ts";

function createMockPi() {
  const commands = new Map<string, any>();
  return {
    registerCommand(name: string, options: any) {
      commands.set(name, options);
    },
    registerTool() {},
    registerShortcut() {},
    on() {},
    sendMessage() {},
    commands,
  };
}

function createMockCtx() {
  const notifications: { message: string; level: string }[] = [];
  return {
    notifications,
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      custom: async () => {},
    },
    shutdown: async () => {},
  };
}

test("/tac update appears in subcommand completions", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  assert.ok(tac, "registerTACCommand should register /tac");

  const completions = tac.getArgumentCompletions("update");
  const updateEntry = completions.find((c: any) => c.value === "update");
  assert.ok(updateEntry, "update should appear in completions");
  assert.equal(updateEntry.label, "update");
});

test("/tac update appears in help description", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  assert.ok(tac?.description?.includes("update"), "description should mention update");
});

test("/tac update is listed in completions with correct description", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  const completions = tac.getArgumentCompletions("");
  const updateEntry = completions.find((c: any) => c.value === "update");
  assert.ok(updateEntry, "update should appear in full completion list");
  assert.ok(
    updateEntry.description.toLowerCase().includes("update"),
    "completion description should mention updating",
  );
});

test("/tac codebase appears in top-level completions", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  const completions = tac.getArgumentCompletions("code");
  const codebaseEntry = completions.find((c: any) => c.value === "codebase");
  assert.ok(codebaseEntry, "codebase should appear in completions");
  assert.match(codebaseEntry.description, /codebase map cache/i);
});

test("/tac codebase appears in help description", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  assert.ok(tac?.description?.includes("codebase"), "description should mention codebase");
});
