import type { ExtensionAPI, ExtensionCommandContext } from "@tac/pi-coding-agent";

import { TACNoProjectError } from "./context.js";
import { handleAutoCommand } from "./handlers/auto.js";
import { handleCoreCommand } from "./handlers/core.js";
import { handleOpsCommand } from "./handlers/ops.js";
import { handleParallelCommand } from "./handlers/parallel.js";
import { handleWorkflowCommand } from "./handlers/workflow.js";

export async function handleTACCommand(
  args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
): Promise<void> {
  const trimmed = (typeof args === "string" ? args : "").trim();

  const handlers = [
    () => handleCoreCommand(trimmed, ctx, pi),
    () => handleAutoCommand(trimmed, ctx, pi),
    () => handleParallelCommand(trimmed, ctx, pi),
    () => handleWorkflowCommand(trimmed, ctx, pi),
    () => handleOpsCommand(trimmed, ctx, pi),
  ];

  try {
    for (const handler of handlers) {
      if (await handler()) {
        return;
      }
    }
  } catch (err) {
    if (err instanceof TACNoProjectError) {
      ctx.ui.notify(
        `${err.message} \`cd\` into a project directory first.`,
        "warning",
      );
      return;
    }
    throw err;
  }

  ctx.ui.notify(`Unknown: /tac ${trimmed}. Run /tac help for available commands.`, "warning");
}
