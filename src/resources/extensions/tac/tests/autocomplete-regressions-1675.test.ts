import test from "node:test";
import assert from "node:assert/strict";

import { registerTACCommand } from "../commands.ts";
import { handleTACCommand } from "../commands/dispatcher.ts";

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

test("/tac description includes discuss", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  assert.ok(tac, "registerTACCommand should register /tac");
  assert.ok(
    tac.description.includes("discuss"),
    "description should include discuss",
  );
});

test("/tac description includes debug", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  assert.ok(tac.description.includes("debug"), "description should include debug");
});

test("/tac next completions include --debug", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  const completions = tac.getArgumentCompletions("next ");
  const debug = completions.find((c: any) => c.value === "next --debug");
  assert.ok(debug, "next --debug should appear in completions");
});

test("/tac debug completions include list|status|continue|--diagnose", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  const completions = tac.getArgumentCompletions("debug ");
  const values = completions.map((c: any) => c.value);
  for (const expected of ["debug list", "debug status", "debug continue", "debug --diagnose"]) {
    assert.ok(values.includes(expected), `missing completion: ${expected}`);
  }
});

test("/tac widget completions include full|small|min|off", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  const completions = tac.getArgumentCompletions("widget ");
  const values = completions.map((c: any) => c.value);
  for (const expected of ["widget full", "widget small", "widget min", "widget off"]) {
    assert.ok(values.includes(expected), `missing completion: ${expected}`);
  }
});

test("/tac logs completions still include debug after adding /tac debug", () => {
  const pi = createMockPi();
  registerTACCommand(pi as any);

  const tac = pi.commands.get("tac");
  const completions = tac.getArgumentCompletions("logs ");
  const values = completions.map((c: any) => c.value);
  assert.ok(values.includes("logs debug"), "logs debug completion should remain available");
});

test("/tac help full includes /tac debug command", async () => {
  const ctx = createMockCtx();

  await handleTACCommand("help full", ctx as any, {} as any);

  const helpText = ctx.notifications.map((n) => n.message).join("\n");
  assert.match(helpText, /\/tac debug\s+Create\/list\/continue persistent debug sessions/);
});

test("bare /tac skip shows usage and does not fall through to unknown-command warning", async () => {
  const ctx = createMockCtx();

  await handleTACCommand("skip", ctx as any, {} as any);

  assert.ok(
    ctx.notifications.some((n) => n.message.includes("Usage: /tac skip <unit-id>")),
    "should show skip usage guidance",
  );
  assert.ok(
    !ctx.notifications.some((n) => n.message.startsWith("Unknown: /tac skip")),
    "should not emit unknown-command warning for bare skip",
  );
});

