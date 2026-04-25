# Full Project Workflow

<template_meta>
name: full-project
version: 1
mode: auto-milestone
requires_project: true
artifact_dir: .tac/
</template_meta>

<purpose>
The complete TAC workflow with full ceremony: roadmap, milestones, slices, tasks,
research, planning, execution, and verification. Use for greenfield projects or
major features that need the full planning apparatus.

This template wraps the existing TAC workflow for registry completeness.
When selected, it routes to the standard /tac init → /tac auto pipeline.
</purpose>

<phases>
1. init    — Initialize project, detect stack, create .tac/
2. discuss — Define requirements, decisions, and architecture
3. plan    — Create roadmap with milestones and slices
4. execute — Execute slices: research → plan → implement → verify per slice
5. verify  — Milestone-level verification and completion
</phases>

<process>

## Routing to Standard TAC

This template is a convenience entry point. When selected via `/tac start full-project`,
it should route to the standard TAC workflow:

1. If `.tac/` doesn't exist: Run `/tac init` to bootstrap the project
2. If `.tac/` exists but no milestones: Start the discuss phase via `/tac discuss`
3. If milestones exist: Resume via `/tac auto` or `/tac next`

The full TAC workflow protocol is defined in `TAC-WORKFLOW.md` and handles all
phases, state tracking, and agent orchestration.

</process>
