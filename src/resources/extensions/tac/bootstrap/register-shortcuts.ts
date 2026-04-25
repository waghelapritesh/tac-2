import { existsSync } from "node:fs";
import { join } from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@tac/pi-coding-agent";
import { Key } from "@tac/pi-tui";

import { TACDashboardOverlay } from "../dashboard-overlay.js";
import { TACNotificationOverlay } from "../notification-overlay.js";
import { ParallelMonitorOverlay } from "../parallel-monitor-overlay.js";
import { TAC_SHORTCUTS } from "../shortcut-defs.js";
import { projectRoot } from "../commands/context.js";
import { shortcutDesc } from "../../shared/mod.js";

export function registerShortcuts(pi: ExtensionAPI): void {
  const overlayOptions = {
    width: "90%",
    minWidth: 80,
    maxHeight: "92%",
    anchor: "center",
  } as const;

  const openDashboardOverlay = async (ctx: ExtensionContext) => {
    const basePath = projectRoot();
    if (!existsSync(join(basePath, ".tac"))) {
      ctx.ui.notify("No .tac/ directory found. Run /tac to start.", "info");
      return;
    }
    await ctx.ui.custom<boolean>(
      (tui, theme, _kb, done) => new TACDashboardOverlay(tui, theme, () => done(true)),
      {
        overlay: true,
        overlayOptions,
      },
    );
  };

  const openNotificationsOverlay = async (ctx: ExtensionContext) => {
    await ctx.ui.custom<boolean>(
      (tui, theme, _kb, done) => new TACNotificationOverlay(tui, theme, () => done(true)),
      {
        overlay: true,
        overlayOptions: {
          width: "80%",
          minWidth: 60,
          maxHeight: "88%",
          anchor: "center",
          backdrop: true,
        },
      },
    );
  };

  const openParallelOverlay = async (ctx: ExtensionContext) => {
    const basePath = projectRoot();
    const parallelDir = join(basePath, ".tac", "parallel");
    if (!existsSync(parallelDir)) {
      ctx.ui.notify("No parallel workers found. Run /tac parallel start first.", "info");
      return;
    }
    await ctx.ui.custom<boolean>(
      (tui, theme, _kb, done) => new ParallelMonitorOverlay(tui, theme, () => done(true), basePath),
      {
        overlay: true,
        overlayOptions,
      },
    );
  };

  pi.registerShortcut(Key.ctrlAlt(TAC_SHORTCUTS.dashboard.key), {
    description: shortcutDesc(TAC_SHORTCUTS.dashboard.action, TAC_SHORTCUTS.dashboard.command),
    handler: openDashboardOverlay,
  });

  // Fallback for terminals where Ctrl+Alt letter chords are not forwarded reliably.
  pi.registerShortcut(Key.ctrlShift(TAC_SHORTCUTS.dashboard.key), {
    description: shortcutDesc(`${TAC_SHORTCUTS.dashboard.action} (fallback)`, TAC_SHORTCUTS.dashboard.command),
    handler: openDashboardOverlay,
  });

  pi.registerShortcut(Key.ctrlAlt(TAC_SHORTCUTS.notifications.key), {
    description: shortcutDesc(TAC_SHORTCUTS.notifications.action, TAC_SHORTCUTS.notifications.command),
    handler: openNotificationsOverlay,
  });

  // Fallback for terminals where Ctrl+Alt letter chords are not forwarded reliably.
  pi.registerShortcut(Key.ctrlShift(TAC_SHORTCUTS.notifications.key), {
    description: shortcutDesc(`${TAC_SHORTCUTS.notifications.action} (fallback)`, TAC_SHORTCUTS.notifications.command),
    handler: openNotificationsOverlay,
  });

  pi.registerShortcut(Key.ctrlAlt(TAC_SHORTCUTS.parallel.key), {
    description: shortcutDesc(TAC_SHORTCUTS.parallel.action, TAC_SHORTCUTS.parallel.command),
    handler: openParallelOverlay,
  });

  // No Ctrl+Shift+P fallback — conflicts with cycleModelBackward (shift+ctrl+p).
  // Use Ctrl+Alt+P or /tac parallel watch instead.
}
