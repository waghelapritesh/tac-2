import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface WorkflowMcpLaunchConfig {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface WorkflowCapabilityOptions {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  surface?: string;
  unitType?: string;
  authMode?: "apiKey" | "oauth" | "externalCli" | "none";
  baseUrl?: string;
}

const MCP_WORKFLOW_TOOL_SURFACE = new Set([
  "ask_user_questions",
  "tac_decision_save",
  "tac_exec",
  "tac_exec_search",
  "tac_resume",
  "tac_complete_milestone",
  "tac_complete_task",
  "tac_complete_slice",
  "tac_generate_milestone_id",
  "tac_journal_query",
  "tac_milestone_complete",
  "tac_milestone_generate_id",
  "tac_checkpoint_db",
  "tac_milestone_status",
  "tac_milestone_validate",
  "tac_plan_task",
  "tac_plan_milestone",
  "tac_plan_slice",
  "tac_replan_slice",
  "tac_reassess_roadmap",
  "tac_requirement_save",
  "tac_requirement_update",
  "tac_roadmap_reassess",
  "tac_save_decision",
  "tac_save_gate_result",
  "tac_save_requirement",
  "tac_skip_slice",
  "tac_slice_replan",
  "tac_slice_complete",
  "tac_summary_save",
  "tac_task_plan",
  "tac_task_complete",
  "tac_update_requirement",
  "tac_validate_milestone",
]);

function parseLookupOutput(output: Buffer | string): string {
  return output
    .toString()
    .trim()
    .split(/\r?\n/)[0] ?? "";
}

function parseJsonEnv<T>(env: NodeJS.ProcessEnv, name: string): T | undefined {
  const raw = env[name];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid JSON in ${name}`);
  }
}

function lookupCommand(command: string, platform: NodeJS.Platform = process.platform): string | null {
  const lookup = platform === "win32" ? `where ${command}` : `which ${command}`;
  try {
    const resolved = parseLookupOutput(execSync(lookup, { timeout: 5_000, stdio: "pipe" }));
    return resolved || null;
  } catch {
    return null;
  }
}

function findWorkflowCliFromAncestorPath(startPath: string): string | null {
  let current = resolve(startPath);

  while (true) {
    const candidate = resolve(current, "packages", "mcp-server", "dist", "cli.js");
    if (existsSync(candidate)) return candidate;

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function getBundledWorkflowMcpCliPath(env: NodeJS.ProcessEnv): string | null {
  const envAnchors = [
    env.TAC_BIN_PATH?.trim(),
    env.TAC_CLI_PATH?.trim(),
    env.TAC_WORKFLOW_PATH?.trim(),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const anchor of envAnchors) {
    const candidate = findWorkflowCliFromAncestorPath(anchor);
    if (candidate) return candidate;
  }

  const candidates = [
    resolve(fileURLToPath(new URL("../../../../packages/mcp-server/src/cli.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../../packages/mcp-server/src/cli.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../packages/mcp-server/dist/cli.js", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../../packages/mcp-server/dist/cli.js", import.meta.url))),
  ];

  for (const bundledCli of candidates) {
    if (existsSync(bundledCli)) return bundledCli;
  }

  return null;
}

function getBundledWorkflowExecutorModulePath(): string | null {
  const candidates = [
    resolve(fileURLToPath(new URL("./tools/workflow-tool-executors.js", import.meta.url))),
    resolve(fileURLToPath(new URL("./tools/workflow-tool-executors.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../dist/resources/extensions/tac/tools/workflow-tool-executors.js", import.meta.url))),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function getBundledWorkflowWriteGateModulePath(): string | null {
  const candidates = [
    resolve(fileURLToPath(new URL("./bootstrap/write-gate.js", import.meta.url))),
    resolve(fileURLToPath(new URL("./bootstrap/write-gate.ts", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../dist/resources/extensions/tac/bootstrap/write-gate.js", import.meta.url))),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function getResolveTsHookPath(): string | null {
  const candidates = [
    resolve(fileURLToPath(new URL("./tests/resolve-ts.mjs", import.meta.url))),
    resolve(fileURLToPath(new URL("../../../../src/resources/extensions/tac/tests/resolve-ts.mjs", import.meta.url))),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function mergeNodeOptions(existing: string | undefined, additions: string[]): string | undefined {
  const tokens = (existing ?? "").split(/\s+/).map((value) => value.trim()).filter(Boolean);
  for (const addition of additions) {
    if (!tokens.includes(addition)) {
      tokens.push(addition);
    }
  }
  return tokens.length > 0 ? tokens.join(" ") : undefined;
}

function buildWorkflowLaunchEnv(
  projectRoot: string,
  tacCliPath: string | undefined,
  explicitEnv?: Record<string, string>,
  workflowCliPath?: string,
): Record<string, string> {
  const executorModulePath = getBundledWorkflowExecutorModulePath();
  const writeGateModulePath = getBundledWorkflowWriteGateModulePath();
  const resolveTsHookPath = getResolveTsHookPath();
  const wantsSourceTs =
    Boolean(resolveTsHookPath) &&
    (
      (workflowCliPath?.endsWith(".ts") ?? false) ||
      (executorModulePath?.endsWith(".ts") ?? false) ||
      (writeGateModulePath?.endsWith(".ts") ?? false)
    );
  const nodeOptions = wantsSourceTs
    ? mergeNodeOptions(explicitEnv?.NODE_OPTIONS, [
        "--experimental-strip-types",
        `--import=${pathToFileURL(resolveTsHookPath!).href}`,
      ])
    : explicitEnv?.NODE_OPTIONS;

  return {
    ...(explicitEnv ?? {}),
    ...(tacCliPath ? { TAC_CLI_PATH: tacCliPath } : {}),
    ...(executorModulePath ? { TAC_WORKFLOW_EXECUTORS_MODULE: executorModulePath } : {}),
    ...(writeGateModulePath ? { TAC_WORKFLOW_WRITE_GATE_MODULE: writeGateModulePath } : {}),
    ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    TAC_PERSIST_WRITE_GATE_STATE: "1",
    TAC_WORKFLOW_PROJECT_ROOT: projectRoot,
  };
}

export function detectWorkflowMcpLaunchConfig(
  projectRoot = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): WorkflowMcpLaunchConfig | null {
  const name = env.TAC_WORKFLOW_MCP_NAME?.trim() || "tac-workflow";
  const explicitCommand = env.TAC_WORKFLOW_MCP_COMMAND?.trim();
  const explicitArgs = parseJsonEnv<unknown>(env, "TAC_WORKFLOW_MCP_ARGS");
  const explicitEnv = parseJsonEnv<Record<string, string>>(env, "TAC_WORKFLOW_MCP_ENV");
  const explicitCwd = env.TAC_WORKFLOW_MCP_CWD?.trim();
  const tacCliPath = env.TAC_CLI_PATH?.trim() || env.TAC_BIN_PATH?.trim();
  const workflowProjectRoot =
    explicitEnv?.TAC_WORKFLOW_PROJECT_ROOT?.trim() ||
    env.TAC_WORKFLOW_PROJECT_ROOT?.trim() ||
    env.TAC_PROJECT_ROOT?.trim() ||
    explicitCwd ||
    projectRoot;
  const resolvedWorkflowProjectRoot = resolve(workflowProjectRoot);

  if (explicitCommand) {
    const launchEnv = buildWorkflowLaunchEnv(resolve(workflowProjectRoot), tacCliPath, explicitEnv);
    return {
      name,
      command: explicitCommand,
      args: Array.isArray(explicitArgs) && explicitArgs.length > 0 ? explicitArgs.map(String) : undefined,
      cwd: explicitCwd || undefined,
      env: Object.keys(launchEnv).length > 0 ? launchEnv : undefined,
    };
  }

  const distCli = resolve(resolvedWorkflowProjectRoot, "packages", "mcp-server", "dist", "cli.js");
  if (existsSync(distCli)) {
    return {
      name,
      command: process.execPath,
      args: [distCli],
      cwd: resolvedWorkflowProjectRoot,
      env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, tacCliPath, undefined, distCli),
    };
  }

  const bundledCli = getBundledWorkflowMcpCliPath(env);
  if (bundledCli) {
    return {
      name,
      command: process.execPath,
      args: [bundledCli],
      cwd: resolvedWorkflowProjectRoot,
      env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, tacCliPath, undefined, bundledCli),
    };
  }

  const binPath = lookupCommand("tac-mcp-server");
  if (binPath) {
    return {
      name,
      command: binPath,
      env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, tacCliPath),
    };
  }

  return null;
}

export function buildWorkflowMcpServers(
  projectRoot = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Record<string, Record<string, unknown>> | undefined {
  const launch = detectWorkflowMcpLaunchConfig(projectRoot, env);
  if (!launch) return undefined;

  return {
    [launch.name]: {
      command: launch.command,
      ...(launch.args && launch.args.length > 0 ? { args: launch.args } : {}),
      ...(launch.env ? { env: launch.env } : {}),
      ...(launch.cwd ? { cwd: launch.cwd } : {}),
    },
  };
}

export function getRequiredWorkflowToolsForGuidedUnit(unitType: string): string[] {
  switch (unitType) {
    case "discuss-milestone":
      return ["tac_summary_save", "tac_plan_milestone"];
    case "discuss-slice":
      return ["tac_summary_save"];
    case "research-milestone":
    case "research-slice":
      return ["tac_summary_save"];
    case "plan-milestone":
      return ["tac_plan_milestone"];
    case "plan-slice":
      return ["tac_plan_slice"];
    case "execute-task":
      return ["tac_task_complete"];
    case "complete-slice":
      return ["tac_slice_complete"];
    default:
      return [];
  }
}

export function getRequiredWorkflowToolsForAutoUnit(unitType: string): string[] {
  switch (unitType) {
    case "discuss-milestone":
      return ["tac_summary_save", "tac_plan_milestone"];
    case "research-milestone":
    case "research-slice":
    case "run-uat":
      return ["tac_summary_save"];
    case "plan-milestone":
      return ["tac_plan_milestone"];
    case "plan-slice":
      return ["tac_plan_slice"];
    case "execute-task":
    case "execute-task-simple":
    case "reactive-execute":
      return ["tac_complete_task"];
    case "complete-slice":
      return ["tac_complete_slice"];
    case "replan-slice":
      return ["tac_replan_slice"];
    case "reassess-roadmap":
      return ["tac_milestone_status", "tac_reassess_roadmap"];
    case "gate-evaluate":
      return ["tac_save_gate_result"];
    case "validate-milestone":
      return ["tac_milestone_status", "tac_validate_milestone"];
    case "complete-milestone":
      return ["tac_milestone_status", "tac_complete_milestone"];
    default:
      return [];
  }
}

export function usesWorkflowMcpTransport(
  authMode: WorkflowCapabilityOptions["authMode"],
  baseUrl: string | undefined,
): boolean {
  return authMode === "externalCli" && typeof baseUrl === "string" && baseUrl.startsWith("local://");
}

export function supportsStructuredQuestions(
  activeTools: string[],
  options: Pick<WorkflowCapabilityOptions, "authMode" | "baseUrl"> = {},
): boolean {
  if (!activeTools.includes("ask_user_questions")) return false;

  return true;
}

export function getWorkflowTransportSupportError(
  provider: string | undefined,
  requiredTools: string[],
  options: WorkflowCapabilityOptions = {},
): string | null {
  if (!provider || requiredTools.length === 0) return null;
  if (!usesWorkflowMcpTransport(options.authMode, options.baseUrl)) return null;

  const projectRoot = options.projectRoot ?? process.cwd();
  const env = options.env ?? process.env;
  const launch = detectWorkflowMcpLaunchConfig(projectRoot, env);
  const surface = options.surface ?? "workflow dispatch";
  const unitLabel = options.unitType ? ` for ${options.unitType}` : "";
  const providerLabel = `"${provider}"`;

  if (!launch) {
    return `Provider ${providerLabel} cannot run ${surface}${unitLabel}: the TAC workflow MCP server is not configured or discoverable. Detected Claude Code model but no workflow MCP. Please run /tac mcp init . from your project root. You can also configure TAC_WORKFLOW_MCP_COMMAND, build packages/mcp-server/dist/cli.js, or install tac-mcp-server on PATH.`;
  }

  const missing = [...new Set(requiredTools)].filter((tool) => !MCP_WORKFLOW_TOOL_SURFACE.has(tool));
  if (missing.length === 0) return null;

  return `Provider ${providerLabel} cannot run ${surface}${unitLabel}: this unit requires ${missing.join(", ")}, but the workflow MCP transport currently exposes only ${Array.from(MCP_WORKFLOW_TOOL_SURFACE).sort().join(", ")}.`;
}
