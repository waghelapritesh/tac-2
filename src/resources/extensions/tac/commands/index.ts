import type { ExtensionAPI, ExtensionCommandContext } from "@tac/pi-coding-agent";

import { TAC_COMMAND_DESCRIPTION, getTacArgumentCompletions } from "./catalog.js";

export function registerTACCommand(pi: ExtensionAPI): void {
  pi.registerCommand("tac", {
    description: TAC_COMMAND_DESCRIPTION,
    getArgumentCompletions: getTacArgumentCompletions,
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const { handleTACCommand } = await import("./dispatcher.js");
      const { setStderrLoggingEnabled } = await import("../workflow-logger.js");
      const previousStderrSetting = setStderrLoggingEnabled(false);
      try {
        await handleTACCommand(args, ctx, pi);
      } finally {
        setStderrLoggingEnabled(previousStderrSetting);
      }
    },
  });
}
