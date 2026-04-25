// Canonical TAC shortcut definitions used by registration, help text, and overlays.

import { formatShortcut } from "./files.js";

export type TACShortcutId = "dashboard" | "notifications" | "parallel";

type TACShortcutDef = {
  key: "g" | "n" | "p";
  action: string;
  command: string;
  /** Whether the Ctrl+Shift fallback is registered (false when it conflicts with an app keybinding). */
  hasFallback: boolean;
};

export const TAC_SHORTCUTS: Record<TACShortcutId, TACShortcutDef> = {
  dashboard: {
    key: "g",
    action: "Open TAC dashboard",
    command: "/tac status",
    hasFallback: true,
  },
  notifications: {
    key: "n",
    action: "Open notification history",
    command: "/tac notifications",
    hasFallback: true,
  },
  parallel: {
    key: "p",
    action: "Open parallel worker monitor",
    command: "/tac parallel watch",
    hasFallback: false, // Ctrl+Shift+P conflicts with cycleModelBackward
  },
};

function combo(prefix: "Ctrl+Alt+" | "Ctrl+Shift+", key: string): string {
  return `${prefix}${key.toUpperCase()}`;
}

export function primaryShortcutCombo(id: TACShortcutId): string {
  return combo("Ctrl+Alt+", TAC_SHORTCUTS[id].key);
}

export function fallbackShortcutCombo(id: TACShortcutId): string {
  return combo("Ctrl+Shift+", TAC_SHORTCUTS[id].key);
}

export function shortcutPair(id: TACShortcutId, formatter: (combo: string) => string = (combo) => combo): string {
  const primary = formatter(primaryShortcutCombo(id));
  if (!TAC_SHORTCUTS[id].hasFallback) return primary;
  return `${primary} / ${formatter(fallbackShortcutCombo(id))}`;
}

export function formattedShortcutPair(id: TACShortcutId): string {
  return shortcutPair(id, formatShortcut);
}
