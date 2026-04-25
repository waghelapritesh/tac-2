import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@tac/pi-coding-agent";
import type { Model } from "@tac/pi-ai";
import type { TACState } from "../../types.js";

import { computeProgressScore, formatProgressLine } from "../../progress-score.js";
import { loadEffectiveTACPreferences, getGlobalTACPreferencesPath, getProjectTACPreferencesPath } from "../../preferences.js";
import { ensurePreferencesFile, handlePrefs, handlePrefsMode, handlePrefsWizard, handleLanguage } from "../../commands-prefs-wizard.js";
import { runEnvironmentChecks } from "../../doctor-environment.js";
import { deriveState } from "../../state.js";
import { handleCmux } from "../../commands-cmux.js";
import { setSessionModelOverride } from "../../session-model-override.js";
import { projectRoot } from "../context.js";
import { formattedShortcutPair } from "../../shortcut-defs.js";

export function showHelp(ctx: ExtensionCommandContext, args = ""): void {
  const summaryLines = [
    "TAC — Think. Architect. Code.\n",
    "QUICK START",
    "  /tac start <tpl>   Start a workflow template",
    "  /tac               Run next unit (same as /tac next)",
    "  /tac auto          Run all queued units continuously",
    "  /tac pause         Pause auto-mode",
    "  /tac stop          Stop auto-mode gracefully",
    "",
    "VISIBILITY",
    `  /tac status         Dashboard  (${formattedShortcutPair("dashboard")})`,
    `  /tac parallel watch Parallel monitor  (${formattedShortcutPair("parallel")})`,
    `  /tac notifications  Notification history  (${formattedShortcutPair("notifications")})`,
    "  /tac visualize      Interactive 10-tab TUI",
    "  /tac queue          Show queued/dispatched units",
    "",
    "COURSE CORRECTION",
    "  /tac steer <desc>   Apply user override to active work",
    "  /tac capture <text> Quick-capture a thought to CAPTURES.md",
    "  /tac triage         Classify and route pending captures",
    "  /tac undo           Revert last completed unit  [--force]",
    "  /tac rethink        Conversational project reorganization",
    "",
    "OBSERVABILITY",
    "  /tac logs           Browse activity and debug logs",
    "  /tac debug          Create/list/continue persistent debug sessions",
    "",
    "SETUP",
    "  /tac onboarding     Re-run setup wizard  [--resume|--reset|--step <name>]",
    "  /tac setup          Configuration hub  [llm|model|search|remote|keys|prefs|onboarding]",
    "  /tac init           Project init wizard",
    "  /tac model          Switch active session model",
    "  /tac prefs          Manage preferences (alias for /tac setup prefs)",
    "  /tac keys           API key manager (LLM + tool keys)",
    "  /tac doctor         Diagnose and repair .tac/ state",
    "",
    "Use /tac help full for the complete command reference.",
  ];

  const fullLines = [
    "TAC — Think. Architect. Code.\n",
    "WORKFLOW",
    "  /tac start <tpl>   Start a workflow template (bugfix, spike, feature, hotfix, etc.)",
    "  /tac templates     List available workflow templates  [info <name>]",
    "  /tac               Run next unit in step mode (same as /tac next)",
    "  /tac next           Execute next task, then pause  [--dry-run] [--verbose]",
    "  /tac auto           Run all queued units continuously  [--verbose]",
    "  /tac stop           Stop auto-mode gracefully",
    "  /tac pause          Pause auto-mode (preserves state, /tac auto to resume)",
    "  /tac discuss        Start guided milestone/slice discussion",
    "  /tac new-milestone  Create milestone from headless context (used by tac headless)",
    "",
    "VISIBILITY",
    `  /tac status         Show progress dashboard  (${formattedShortcutPair("dashboard")})`,
    `  /tac parallel watch Open parallel worker monitor  (${formattedShortcutPair("parallel")})`,
    "  /tac visualize      Interactive 10-tab TUI (progress, timeline, deps, metrics, health, agent, changes, knowledge, captures, export)",
    "  /tac queue          Show queued/dispatched units and execution order",
    "  /tac history        View execution history  [--cost] [--phase] [--model] [N]",
    "  /tac changelog      Show categorized release notes  [version]",
    `  /tac notifications  View persistent notification history  [clear|tail|filter]  (${formattedShortcutPair("notifications")})`,
    "  /tac logs           Browse activity logs, debug logs, and metrics",
    "  /tac debug          Create/list/continue persistent debug sessions",
    "",
    "COURSE CORRECTION",
    "  /tac steer <desc>   Apply user override to active work",
    "  /tac capture <text> Quick-capture a thought to CAPTURES.md",
    "  /tac triage         Classify and route pending captures",
    "  /tac skip <unit>    Prevent a unit from auto-mode dispatch",
    "  /tac undo           Revert last completed unit  [--force]",
    "  /tac rethink        Conversational project reorganization — reorder, park, discard, add milestones",
    "  /tac park [id]      Park a milestone — skip without deleting  [reason]",
    "  /tac unpark [id]    Reactivate a parked milestone",
    "",
    "PROJECT KNOWLEDGE",
    "  /tac knowledge <type> <text>   Add rule, pattern, or lesson to KNOWLEDGE.md",
    "  /tac codebase [generate|update|stats]   Manage the CODEBASE.md cache used in prompt context",
    "",
    "SETUP & CONFIGURATION",
    "  /tac onboarding     Re-run setup wizard  [--resume|--reset|--step <name>]",
    "  /tac setup          Configuration hub  [llm|model|search|remote|keys|prefs|onboarding]",
    "  /tac init           Project init wizard — detect, configure, bootstrap .tac/",
    "  /tac model          Switch active session model  [provider/model|model-id]",
    "  /tac mode           Set workflow mode (solo/team)  [global|project]",
    "  /tac prefs          Manage preferences  [global|project|status|wizard|setup|import-claude]  (alias for /tac setup prefs)",
    "  /tac cmux           Manage cmux integration  [status|on|off|notifications|sidebar|splits|browser]",
    "  /tac keys           API key manager (LLM + tool keys)  [list|add|remove|test|rotate|doctor]",
    "  /tac config         (deprecated) Set tool API keys — use /tac keys instead",
    "  /tac show-config    Show effective configuration (models, routing, toggles)",
    "  /tac hooks          Show post-unit hook configuration",
    "  /tac extensions     Manage extensions  [list|enable|disable|info]",
    "  /tac fast           Toggle OpenAI service tier  [on|off|flex|status]",
    "  /tac mcp            MCP server status and connectivity  [status|check <server>|init [dir]]",
    "",
    "MAINTENANCE",
    "  /tac doctor         Diagnose and repair .tac/ state  [audit|fix|heal] [scope]",
    "  /tac export         Export milestone/slice results  [--json|--markdown|--html] [--all]",
    "  /tac cleanup        Remove merged branches or snapshots  [branches|snapshots]",
    "  /tac migrate        Migrate .planning/ (v1) to .tac/ (v2) format",
    "  /tac remote         Control remote auto-mode  [slack|discord|status|disconnect]",
    "  /tac inspect        Show SQLite DB diagnostics (schema, row counts, recent entries)",
    "  /tac update         Update TAC to the latest version via npm",
  ];
  const full = ["full", "--full", "all"].includes(args.trim().toLowerCase());
  ctx.ui.notify((full ? fullLines : summaryLines).join("\n"), "info");
}

export async function handleStatus(ctx: ExtensionCommandContext): Promise<void> {
  const basePath = projectRoot();
  // Open DB in cold sessions so status uses DB-backed state, not filesystem fallback (#3385)
  const { ensureDbOpen } = await import("../../bootstrap/dynamic-tools.js");
  await ensureDbOpen();
  const state = await deriveState(basePath);

  if (state.registry.length === 0) {
    ctx.ui.notify("No TAC milestones found. Run /tac to start.", "info");
    return;
  }

  const { TACDashboardOverlay } = await import("../../dashboard-overlay.js");
  const result = await ctx.ui.custom<boolean>(
    (tui, theme, _kb, done) => new TACDashboardOverlay(tui, theme, () => done(true)),
    {
      overlay: true,
      overlayOptions: {
        width: "90%",
        minWidth: 80,
        maxHeight: "92%",
        anchor: "center",
      },
    },
  );

  if (result === undefined) {
    ctx.ui.notify(formatTextStatus(state), "info");
  }
}

export async function fireStatusViaCommand(ctx: ExtensionContext): Promise<void> {
  await handleStatus(ctx as ExtensionCommandContext);
}

export async function handleVisualize(ctx: ExtensionCommandContext): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Visualizer requires an interactive terminal.", "warning");
    return;
  }

  const { TACVisualizerOverlay } = await import("../../visualizer-overlay.js");
  const result = await ctx.ui.custom<boolean>(
    (tui, theme, _kb, done) => new TACVisualizerOverlay(tui, theme, () => done(true)),
    {
      overlay: true,
      overlayOptions: {
        width: "80%",
        minWidth: 80,
        maxHeight: "90%",
        anchor: "center",
      },
    },
  );

  if (result === undefined) {
    ctx.ui.notify("Visualizer requires an interactive terminal. Use /tac status for a text-based overview.", "warning");
  }
}

export async function handleSetup(args: string, ctx: ExtensionCommandContext, pi?: ExtensionAPI): Promise<void> {
  const { detectProjectState, hasGlobalSetup } = await import("../../detection.js");
  const { isOnboardingComplete, readOnboardingRecord } = await import("../../onboarding-state.js");

  // Sub-route dispatch — keep redirects but route the canonical work to /tac
  // onboarding (single source for wizard steps) and /tac keys (single source
  // for credentials).
  if (args === "onboarding" || args === "wizard") {
    const { handleOnboarding } = await import("./onboarding.js");
    await handleOnboarding("", ctx);
    return;
  }
  if (args === "llm" || args === "auth") {
    const { handleOnboarding } = await import("./onboarding.js");
    await handleOnboarding("--step llm", ctx);
    return;
  }
  if (args === "search") {
    const { handleOnboarding } = await import("./onboarding.js");
    await handleOnboarding("--step search", ctx);
    return;
  }
  if (args === "remote") {
    const { handleOnboarding } = await import("./onboarding.js");
    await handleOnboarding("--step remote", ctx);
    return;
  }
  if (args === "model") {
    await handleModel("", ctx, pi);
    return;
  }
  if (args === "keys") {
    ctx.ui.notify("Tip: /tac keys is the canonical command for API key management.", "info");
    const { handleKeys } = await import("../../key-manager.js");
    await handleKeys("", ctx);
    return;
  }
  if (args === "prefs") {
    await ensurePreferencesFile(getGlobalTACPreferencesPath(), ctx, "global");
    await handlePrefsWizard(ctx, "global");
    return;
  }

  // Bare /tac setup — render the hub: status + actions
  const globalConfigured = hasGlobalSetup();
  const detection = detectProjectState(projectRoot());
  const onboardingDone = isOnboardingComplete();
  const record = readOnboardingRecord();

  const statusLines: string[] = ["TAC Setup\n"];
  statusLines.push(
    onboardingDone
      ? `  Onboarding:         ✓ complete${record.completedAt ? ` (${record.completedAt.slice(0, 10)})` : ""}`
      : `  Onboarding:         ○ not complete  —  /tac onboarding to start`,
  );
  statusLines.push(`  Global preferences: ${globalConfigured ? "configured" : "not set"}`);
  statusLines.push(`  Project state:      ${detection.state}`);
  if (detection.projectSignals.primaryLanguage) {
    statusLines.push(`  Detected:           ${detection.projectSignals.primaryLanguage}`);
  }

  ctx.ui.notify(statusLines.join("\n"), "info");
  ctx.ui.notify(
    "Configuration hub:\n" +
    "  /tac setup llm        — LLM provider & auth\n" +
    "  /tac setup model      — Default model picker\n" +
    "  /tac setup search     — Web search provider\n" +
    "  /tac setup remote     — Remote questions (Discord/Slack/Telegram)\n" +
    "  /tac setup keys       — API keys (alias for /tac keys)\n" +
    "  /tac setup prefs      — Global preferences (alias for /tac prefs)\n" +
    "  /tac setup onboarding — Full wizard (alias for /tac onboarding)\n\n" +
    "Tip: /tac onboarding --resume to continue an incomplete setup.",
    "info",
  );
}

function sortModelsForSelection(models: Model<any>[], currentModel: Model<any> | undefined): Model<any>[] {
  return [...models].sort((a, b) => {
    const aCurrent = currentModel && a.provider === currentModel.provider && a.id === currentModel.id;
    const bCurrent = currentModel && b.provider === currentModel.provider && b.id === currentModel.id;
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;
    const providerCmp = a.provider.localeCompare(b.provider);
    if (providerCmp !== 0) return providerCmp;
    return a.id.localeCompare(b.id);
  });
}

function buildProviderModelGroups(
  models: Model<any>[],
  currentModel: Model<any> | undefined,
): Map<string, Model<any>[]> {
  const byProvider = new Map<string, Model<any>[]>();

  for (const model of sortModelsForSelection(models, currentModel)) {
    let group = byProvider.get(model.provider);
    if (!group) {
      group = [];
      byProvider.set(model.provider, group);
    }
    group.push(model);
  }
  return byProvider;
}

async function selectModelByProvider(
  title: string,
  models: Model<any>[],
  ctx: ExtensionCommandContext,
  currentModel: Model<any> | undefined,
): Promise<Model<any> | undefined> {
  const byProvider = buildProviderModelGroups(models, currentModel);
  const providerOptions = Array.from(byProvider.entries()).map(([provider, group]) =>
    `${provider} (${group.length} model${group.length === 1 ? "" : "s"})`,
  );
  providerOptions.push("(cancel)");

  const providerChoice = await ctx.ui.select(`${title} — choose provider:`, providerOptions);
  if (!providerChoice || typeof providerChoice !== "string" || providerChoice === "(cancel)") return undefined;

  const providerName = providerChoice.replace(/ \(\d+ models?\)$/, "");
  const providerModels = byProvider.get(providerName);
  if (!providerModels || providerModels.length === 0) return undefined;

  const optionToModel = new Map<string, Model<any>>();
  const modelOptions = providerModels.map((model) => {
    const isCurrent = currentModel && model.provider === currentModel.provider && model.id === currentModel.id;
    const label = `${isCurrent ? "* " : ""}${model.id}`;
    optionToModel.set(label, model);
    return label;
  });
  modelOptions.push("(cancel)");

  const modelChoice = await ctx.ui.select(`${title} — ${providerName}:`, modelOptions);
  if (!modelChoice || typeof modelChoice !== "string" || modelChoice === "(cancel)") return undefined;
  return optionToModel.get(modelChoice);
}

async function resolveRequestedModel(
  query: string,
  ctx: ExtensionCommandContext,
): Promise<Model<any> | undefined> {
  const { resolveModelId } = await import("../../auto-model-selection.js");
  const models = ctx.modelRegistry.getAvailable();
  const exact = resolveModelId(query, models, ctx.model?.provider);
  if (exact) return exact;

  const lowerQuery = query.toLowerCase();
  const partialMatches = models.filter((model) =>
    model.id.toLowerCase().includes(lowerQuery)
      || `${model.provider}/${model.id}`.toLowerCase().includes(lowerQuery),
  );

  if (partialMatches.length === 1) return partialMatches[0];
  if (partialMatches.length === 0 || !ctx.hasUI) return undefined;
  return selectModelByProvider(`Multiple models match "${query}"`, partialMatches, ctx, ctx.model);
}

async function handleModel(trimmedArgs: string, ctx: ExtensionCommandContext, pi: ExtensionAPI | undefined): Promise<void> {
  const availableModels = ctx.modelRegistry.getAvailable();
  if (availableModels.length === 0) {
    ctx.ui.notify("No available models found. Check provider auth and model discovery.", "warning");
    return;
  }
  if (!pi) {
    ctx.ui.notify("Model switching is unavailable in this context.", "warning");
    return;
  }

  const trimmed = trimmedArgs.trim();
  let targetModel: Model<any> | undefined;

  if (!trimmed) {
    if (!ctx.hasUI) {
      const current = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "(none)";
      ctx.ui.notify(`Current model: ${current}\nUsage: /tac model <provider/model|model-id>`, "info");
      return;
    }

    targetModel = await selectModelByProvider("Select session model:", availableModels, ctx, ctx.model);
  } else {
    targetModel = await resolveRequestedModel(trimmed, ctx);
  }

  if (!targetModel) {
    ctx.ui.notify(`Model "${trimmed}" not found. Use /tac model with an exact provider/model or a unique model ID.`, "warning");
    return;
  }

  const ok = await pi.setModel(targetModel);
  if (!ok) {
    ctx.ui.notify(`No API key for ${targetModel.provider}/${targetModel.id}`, "warning");
    return;
  }

  // /tac model is an explicit per-session pin for TAC dispatches.
  // This is captured at auto bootstrap so it survives internal session
  // switches during /tac auto and /tac next runs.
  const sessionId = ctx.sessionManager?.getSessionId?.();
  if (sessionId) {
    setSessionModelOverride(sessionId, {
      provider: targetModel.provider,
      id: targetModel.id,
    });
  }

  ctx.ui.notify(`Model: ${targetModel.provider}/${targetModel.id}`, "info");
}

export async function handleCoreCommand(
  trimmed: string,
  ctx: ExtensionCommandContext,
  pi?: ExtensionAPI,
): Promise<boolean> {
  if (trimmed === "help" || trimmed === "h" || trimmed === "?" || trimmed.startsWith("help ")) {
    showHelp(ctx, trimmed.startsWith("help ") ? trimmed.slice(5).trim() : "");
    return true;
  }
  if (trimmed === "status") {
    await handleStatus(ctx);
    return true;
  }
  if (trimmed === "visualize") {
    await handleVisualize(ctx);
    return true;
  }
  if (trimmed === "widget" || trimmed.startsWith("widget ")) {
    const { cycleWidgetMode, setWidgetMode, getWidgetMode } = await import("../../auto-dashboard.js");
    const arg = trimmed.replace(/^widget\s*/, "").trim();
    if (arg === "full" || arg === "small" || arg === "min" || arg === "off") {
      setWidgetMode(arg);
    } else {
      cycleWidgetMode();
    }
    ctx.ui.notify(`Widget: ${getWidgetMode()}`, "info");
    return true;
  }
  if (trimmed === "model" || trimmed.startsWith("model ")) {
    await handleModel(trimmed.replace(/^model\s*/, "").trim(), ctx, pi);
    return true;
  }
  if (trimmed === "mode" || trimmed.startsWith("mode ")) {
    const modeArgs = trimmed.replace(/^mode\s*/, "").trim();
    const scope = modeArgs === "project" ? "project" : "global";
    const path = scope === "project" ? getProjectTACPreferencesPath() : getGlobalTACPreferencesPath();
    await ensurePreferencesFile(path, ctx, scope);
    await handlePrefsMode(ctx, scope);
    return true;
  }
  if (trimmed === "prefs" || trimmed.startsWith("prefs ")) {
    await handlePrefs(trimmed.replace(/^prefs\s*/, "").trim(), ctx);
    return true;
  }
  if (trimmed === "language" || trimmed.startsWith("language ")) {
    await handleLanguage(trimmed.replace(/^language\s*/, "").trim(), ctx);
    return true;
  }
  if (trimmed === "cmux" || trimmed.startsWith("cmux ")) {
    await handleCmux(trimmed.replace(/^cmux\s*/, "").trim(), ctx);
    return true;
  }
  if (trimmed === "show-config") {
    const { TACConfigOverlay, formatConfigText } = await import("../../config-overlay.js");
    const result = await ctx.ui.custom<boolean>(
      (tui, theme, _kb, done) => new TACConfigOverlay(tui, theme, () => done(true)),
      {
        overlay: true,
        overlayOptions: {
          width: "65%",
          minWidth: 55,
          maxHeight: "85%",
          anchor: "center",
        },
      },
    );
    if (result === undefined) {
      ctx.ui.notify(formatConfigText(), "info");
    }
    return true;
  }
  if (trimmed === "setup" || trimmed.startsWith("setup ")) {
    await handleSetup(trimmed.replace(/^setup\s*/, "").trim(), ctx, pi);
    return true;
  }
  if (trimmed === "onboarding" || trimmed.startsWith("onboarding ")) {
    const { handleOnboarding } = await import("./onboarding.js");
    await handleOnboarding(trimmed.replace(/^onboarding\s*/, "").trim(), ctx);
    return true;
  }
  return false;
}

export function formatTextStatus(state: TACState): string {
  const lines: string[] = ["TAC Status\n"];
  lines.push(formatProgressLine(computeProgressScore()));
  lines.push("");
  lines.push(`Phase: ${state.phase}`);

  if (state.activeMilestone) {
    lines.push(`Active milestone: ${state.activeMilestone.id} — ${state.activeMilestone.title}`);
  }
  if (state.activeSlice) {
    lines.push(`Active slice: ${state.activeSlice.id} — ${state.activeSlice.title}`);
  }
  if (state.activeTask) {
    lines.push(`Active task: ${state.activeTask.id} — ${state.activeTask.title}`);
  }
  if (state.progress) {
    const { milestones, slices, tasks } = state.progress;
    const parts: string[] = [`milestones ${milestones.done}/${milestones.total}`];
    if (slices) parts.push(`slices ${slices.done}/${slices.total}`);
    if (tasks) parts.push(`tasks ${tasks.done}/${tasks.total}`);
    lines.push(`Progress: ${parts.join(", ")}`);
  }
  if (state.nextAction) {
    lines.push(`Next: ${state.nextAction}`);
  }
  if (state.blockers.length > 0) {
    lines.push(`Blockers: ${state.blockers.join("; ")}`);
  }
  if (state.registry.length > 0) {
    lines.push("");
    lines.push("Milestones:");
    for (const milestone of state.registry) {
      const icon = milestone.status === "complete"
        ? "✓"
        : milestone.status === "active"
          ? "▶"
          : milestone.status === "parked"
            ? "⏸"
            : "○";
      lines.push(`  ${icon} ${milestone.id}: ${milestone.title} (${milestone.status})`);
    }
  }

  const envResults = runEnvironmentChecks(projectRoot());
  const envIssues = envResults.filter((result) => result.status !== "ok");
  if (envIssues.length > 0) {
    lines.push("");
    lines.push("Environment:");
    for (const issue of envIssues) {
      lines.push(`  ${issue.status === "error" ? "✗" : "⚠"} ${issue.message}`);
    }
  }

  return lines.join("\n");
}
