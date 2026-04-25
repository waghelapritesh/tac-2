# Working in Teams

TAC supports multi-user workflows where several developers work on the same repository concurrently.

## Setup

### 1. Set Team Mode

The simplest way to configure TAC for team use is to set `mode: team` in your project preferences. This enables unique milestone IDs, push branches, and pre-merge checks in one setting:

```yaml
# .tac/PREFERENCES.md (project-level, committed to git)
---
version: 1
mode: team
---
```

This is equivalent to manually setting `unique_milestone_ids: true`, `git.push_branches: true`, `git.pre_merge_check: true`, and other team-appropriate defaults. You can still override individual settings — for example, adding `git.auto_push: true` on top of `mode: team` if your team prefers auto-push.

Alternatively, you can configure each setting individually without using a mode (see [Git Strategy](git-strategy.md) for details).

### 2. Configure `.gitignore`

Share planning artifacts (milestones, roadmaps, decisions) while keeping runtime files local:

```bash
# ── TAC: Runtime / Ephemeral (per-developer, per-session) ──────
.tac/auto.lock
.tac/completed-units.json
.tac/STATE.md
.tac/metrics.json
.tac/activity/
.tac/runtime/
.tac/worktrees/
.tac/milestones/**/continue.md
.tac/milestones/**/*-CONTINUE.md
```

**What gets shared** (committed to git):
- `.tac/PREFERENCES.md` — project preferences
- `.tac/PROJECT.md` — living project description
- `.tac/REQUIREMENTS.md` — requirement contract
- `.tac/DECISIONS.md` — architectural decisions
- `.tac/milestones/` — roadmaps, plans, summaries, research

**What stays local** (gitignored):
- Lock files, metrics, state cache, runtime records, worktrees, activity logs

### 3. Commit the Preferences

```bash
git add .tac/PREFERENCES.md
git commit -m "chore: enable TAC team workflow"
```

## `commit_docs: false`

For teams where only some members use TAC, or when company policy requires a clean repo:

```yaml
git:
  commit_docs: false
```

This adds `.tac/` to `.gitignore` entirely and keeps all artifacts local. The developer gets the benefits of structured planning without affecting teammates who don't use TAC.

## Migrating an Existing Project

If you have an existing project with `.tac/` blanket-ignored:

1. Ensure no milestones are in progress (clean state)
2. Update `.gitignore` to use the selective pattern above
3. Add `unique_milestone_ids: true` to `.tac/PREFERENCES.md`
4. Optionally rename existing milestones to use unique IDs:
   ```
   I have turned on unique milestone ids, please update all old milestone
   ids to use this new format e.g. M001-abc123 where abc123 is a random
   6 char lowercase alpha numeric string. Update all references in all
   .tac file contents, file names and directory names. Validate your work
   once done to ensure referential integrity.
   ```
5. Commit

## Plan Review Workflow

Teams configured to track planning artifacts in git (i.e. with `mode: team` and `.tac/milestones/` not gitignored) can use a two-PR cycle to get plan approval before any code is written:

1. **Plan PR** — developer runs `/tac discuss` on `main`, which writes planning artifacts to `.tac/milestones/<MID>/` (milestone files `<MID>-CONTEXT.md` and `<MID>-ROADMAP.md`) and updates the top-level `.tac/REQUIREMENTS.md` and `.tac/DECISIONS.md`. The developer commits these and opens a docs-only PR.
2. **Review** — the team reviews scope, risks, slice breakdown, and definition of done directly in GitHub. No code to review yet, just the plan.
3. **Code PR** — after the plan PR is merged, the developer pulls `main` and runs `/tac auto`. TAC creates a worktree and executes against the approved plan. The result is a second PR with the actual implementation.

`/tac discuss` does not auto-commit — the developer controls when and how planning artifacts are committed.

### What reviewers should look for

- **`<MID>-CONTEXT.md`** — is the scope well-defined? Are constraints and non-goals clear?
- **`<MID>-ROADMAP.md`** — does the slice breakdown make sense? Are slices ordered by dependency?
- **`.tac/DECISIONS.md`** — are the architectural choices justified?

### Steering during execution

If the developer uses `/tac steer` from within the auto-mode worktree, those adjustments remain local to that worktree and write to `.tac/OVERRIDES.md` in the worktree — they don't modify the approved plan docs on `main`. These changes will appear in the code PR diff alongside the implementation. Running `/tac steer` outside the worktree modifies whichever checkout it is run from.

### Automated gates

For teams that want a required discussion checkpoint before each slice (not just the milestone), add `require_slice_discussion: true` to preferences:

```yaml
phases:
  require_slice_discussion: true
```

This pauses auto-mode when a slice is missing its slice `CONTEXT` file and requires the developer to run `/tac discuss` for that slice before proceeding.

## Parallel Development

Multiple developers can run auto mode simultaneously on different milestones. Each developer:

- Gets their own worktree (`.tac/worktrees/<MID>/`, gitignored)
- Works on a unique `milestone/<MID>` branch
- Squash-merges to main independently

Milestone dependencies can be declared in `M00X-CONTEXT.md` frontmatter:

```yaml
---
depends_on: [M001-eh88as]
---
```

TAC enforces that dependent milestones complete before starting downstream work.
