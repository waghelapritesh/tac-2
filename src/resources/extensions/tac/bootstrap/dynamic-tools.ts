import { existsSync } from "node:fs";
import { join, sep } from "node:path";

import type { ExtensionAPI } from "@tac/pi-coding-agent";
import { createBashTool, createEditTool, createReadTool, createWriteTool } from "@tac/pi-coding-agent";

import { DEFAULT_BASH_TIMEOUT_SECS } from "../constants.js";
import { setLogBasePath, logWarning } from "../workflow-logger.js";

/**
 * Resolve the correct DB path for the current working directory.
 * If `basePath` is inside a `.tac/worktrees/<MID>/` directory, returns
 * the project root's `.tac/tac.db` (shared WAL — R012). Otherwise
 * returns `<basePath>/.tac/tac.db`.
 */
export function resolveProjectRootDbPath(basePath: string): string {
  // Detect worktree: look for `.tac/worktrees/` in the path segments.
  // A worktree path looks like: /project/root/.tac/worktrees/M001/...
  // We need to resolve back to /project/root/.tac/tac.db
  const marker = `${sep}.tac${sep}worktrees${sep}`;
  const idx = basePath.indexOf(marker);
  if (idx !== -1) {
    const projectRoot = basePath.slice(0, idx);
    return join(projectRoot, ".tac", "tac.db");
  }

  // Also handle forward-slash paths on all platforms
  const fwdMarker = "/.tac/worktrees/";
  const fwdIdx = basePath.indexOf(fwdMarker);
  if (fwdIdx !== -1) {
    const projectRoot = basePath.slice(0, fwdIdx);
    return join(projectRoot, ".tac", "tac.db");
  }

  // External-state layout: ~/.tac/projects/<hash>/worktrees/<MID>/...
  // Resolve to ~/.tac/projects/<hash>/tac.db (the canonical project DB) (#2952).
  // Must be checked before the generic symlink-resolved handler: both match
  // /.tac/projects/<hash>/worktrees/ but require different resolution targets.
  const extRe = /[/\\]\.tac[/\\]projects[/\\][a-f0-9]+[/\\]worktrees(?:[/\\]|$)/;
  const extMatch = extRe.exec(basePath);
  if (extMatch) {
    const matchStr = extMatch[0];
    // Find the "/worktrees" portion within the match and slice up to it
    const wtIdx = matchStr.search(/[/\\]worktrees(?:[/\\]|$)/);
    const projectStateRoot = basePath.slice(0, extMatch.index + wtIdx);
    return join(projectStateRoot, "tac.db");
  }

  // Symlink-resolved layout: /.tac/projects/<hash>/worktrees/M001/...
  // The project root is everything before /.tac/projects/ (#2517)
  const symlinkMarker = `${sep}.tac${sep}projects${sep}`;
  const symlinkIdx = basePath.indexOf(symlinkMarker);
  if (symlinkIdx !== -1) {
    const afterProjects = basePath.slice(symlinkIdx + symlinkMarker.length);
    // Expect: <hash>/worktrees/...
    const worktreeSeg = `${sep}worktrees${sep}`;
    if (afterProjects.includes(worktreeSeg)) {
      const projectRoot = basePath.slice(0, symlinkIdx);
      return join(projectRoot, ".tac", "tac.db");
    }
  }

  // Forward-slash variant for symlink-resolved layout
  const fwdSymlinkMarker = "/.tac/projects/";
  const fwdSymlinkIdx = basePath.indexOf(fwdSymlinkMarker);
  if (fwdSymlinkIdx !== -1) {
    const afterProjects = basePath.slice(fwdSymlinkIdx + fwdSymlinkMarker.length);
    if (afterProjects.includes("/worktrees/")) {
      const projectRoot = basePath.slice(0, fwdSymlinkIdx);
      return join(projectRoot, ".tac", "tac.db");
    }
  }


  return join(basePath, ".tac", "tac.db");
}

export async function ensureDbOpen(basePath: string = process.cwd()): Promise<boolean> {
  try {
    const db = await import("../tac-db.js");
    const dbPath = resolveProjectRootDbPath(basePath);
    const tacDir = join(basePath, ".tac");

    // Derive the project root from the DB path (strip .tac/tac.db)
    const projectRoot = join(dbPath, "..", "..");

    // Open existing DB file (may be at project root for worktrees)
    if (existsSync(dbPath)) {
      const opened = db.openDatabase(dbPath);
      if (opened) setLogBasePath(projectRoot);
      return opened;
    }

    // No DB file — create + migrate from Markdown if .tac/ has content
    if (existsSync(tacDir)) {
      const hasDecisions = existsSync(join(tacDir, "DECISIONS.md"));
      const hasRequirements = existsSync(join(tacDir, "REQUIREMENTS.md"));
      const hasMilestones = existsSync(join(tacDir, "milestones"));
      if (hasDecisions || hasRequirements || hasMilestones) {
        const opened = db.openDatabase(dbPath);
        if (opened) {
          setLogBasePath(projectRoot);
          try {
            const { migrateFromMarkdown } = await import("../md-importer.js");
            migrateFromMarkdown(basePath);
          } catch (err) {
            logWarning("bootstrap", `ensureDbOpen auto-migration failed: ${(err as Error).message}`);
          }
        }
        return opened;
      }

      // .tac/ exists but has no Markdown content (fresh project) — create empty DB
      const opened = db.openDatabase(dbPath);
      if (opened) setLogBasePath(projectRoot);
      return opened;
    }

    logWarning("bootstrap", "ensureDbOpen failed — no .tac directory found");
    return false;
  } catch (err) {
    logWarning("bootstrap", `ensureDbOpen failed: ${(err as Error).message ?? String(err)}`);
    return false;
  }
}

export function registerDynamicTools(pi: ExtensionAPI): void {
  const baseBash = createBashTool(process.cwd(), {
    spawnHook: (ctx) => ({ ...ctx, cwd: process.cwd() }),
  });
  const dynamicBash = {
    ...baseBash,
    execute: async (
      toolCallId: string,
      params: { command: string; timeout?: number },
      signal?: AbortSignal,
      onUpdate?: unknown,
      ctx?: unknown,
    ) => {
      const paramsWithTimeout = {
        ...params,
        timeout: params.timeout ?? DEFAULT_BASH_TIMEOUT_SECS,
      };
      return (baseBash as any).execute(toolCallId, paramsWithTimeout, signal, onUpdate, ctx);
    },
  };
  pi.registerTool(dynamicBash as any);

  const baseWrite = createWriteTool(process.cwd());
  pi.registerTool({
    ...baseWrite,
    execute: async (
      toolCallId: string,
      params: { path: string; content: string },
      signal?: AbortSignal,
      onUpdate?: unknown,
      ctx?: unknown,
    ) => {
      const fresh = createWriteTool(process.cwd());
      return (fresh as any).execute(toolCallId, params, signal, onUpdate, ctx);
    },
  } as any);

  const baseRead = createReadTool(process.cwd());
  pi.registerTool({
    ...baseRead,
    execute: async (
      toolCallId: string,
      params: { path: string; offset?: number; limit?: number },
      signal?: AbortSignal,
      onUpdate?: unknown,
      ctx?: unknown,
    ) => {
      const fresh = createReadTool(process.cwd());
      return (fresh as any).execute(toolCallId, params, signal, onUpdate, ctx);
    },
  } as any);

  const baseEdit = createEditTool(process.cwd());
  pi.registerTool({
    ...baseEdit,
    execute: async (
      toolCallId: string,
      params: { path: string; oldText: string; newText: string },
      signal?: AbortSignal,
      onUpdate?: unknown,
      ctx?: unknown,
    ) => {
      const fresh = createEditTool(process.cwd());
      return (fresh as any).execute(toolCallId, params, signal, onUpdate, ctx);
    },
  } as any);
}
