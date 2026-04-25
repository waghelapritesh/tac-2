/**
 * TAC branch naming patterns — single source of truth.
 *
 * tac/<worktree>/<milestone>/<slice>  → SLICE_BRANCH_RE
 * tac/quick/<id>-<slug>               → QUICK_BRANCH_RE
 * tac/<workflow>/<...>                 → WORKFLOW_BRANCH_RE (non-milestone tac/ branches)
 */

/** Matches tac/ slice branches: tac/[worktree/]M001[-hash]/S01 */
export const SLICE_BRANCH_RE = /^tac\/(?:([a-zA-Z0-9_-]+)\/)?(M\d+(?:-[a-z0-9]{6})?)\/(S\d+)$/;

/** Matches tac/quick/ task branches */
export const QUICK_BRANCH_RE = /^tac\/quick\//;

/** Matches tac/ workflow branches (non-milestone, e.g. tac/workflow-name/...) */
export const WORKFLOW_BRANCH_RE = /^tac\/(?!M\d)[\w-]+\//;
