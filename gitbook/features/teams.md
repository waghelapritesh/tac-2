# Working in Teams

TAC supports multi-user workflows where several developers work on the same repository concurrently.

## Quick Setup

The simplest way: set team mode in your project preferences.

```yaml
# .tac/PREFERENCES.md (committed to git)
---
version: 1
mode: team
---
```

This enables unique milestone IDs, push branches, pre-merge checks, and other team-appropriate defaults in one setting.

## What Team Mode Does

| Setting | Effect |
|---------|--------|
| `unique_milestone_ids` | IDs like `M001-eh88as` instead of `M001` — no collisions |
| `git.push_branches` | Milestone branches are pushed to remote |
| `git.pre_merge_check` | Validation runs before merging |

You can override individual settings on top of `mode: team`.

## Configure `.gitignore`

Share planning artifacts while keeping runtime files local:

```bash
# Runtime files (per-developer, gitignore these)
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
- Lock files, metrics, state, activity logs, worktrees

## Commit the Config

```bash
git add .tac/PREFERENCES.md
git commit -m "chore: enable TAC team workflow"
```

## Keeping `.tac/` Local

For teams where only some members use TAC:

```yaml
git:
  commit_docs: false
```

This gitignores `.tac/` entirely. You get structured planning without affecting teammates.

## Parallel Development

Multiple developers can run auto mode simultaneously on different milestones. Each developer:

- Gets their own worktree (`.tac/worktrees/<MID>/`)
- Works on a unique `milestone/<MID>` branch
- Squash-merges to main independently

Milestone dependencies can be declared:

```yaml
# In M00X-CONTEXT.md frontmatter
---
depends_on: [M001-eh88as]
---
```

TAC enforces that dependent milestones complete before starting downstream work.
