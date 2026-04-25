# Commands

## Session Commands

| Command | Description |
|---------|-------------|
| `/tac` | Step mode — execute one unit at a time |
| `/tac auto` | Autonomous mode — research, plan, execute, commit, repeat |
| `/tac quick` | Quick task with TAC guarantees but no full planning |
| `/tac stop` | Stop auto mode gracefully |
| `/tac pause` | Pause auto mode (preserves state) |
| `/tac steer` | Modify plan documents during execution |
| `/tac discuss` | Discuss architecture and decisions |
| `/tac status` | Progress dashboard |
| `/tac widget` | Cycle dashboard widget: full / small / min / off |
| `/tac queue` | Queue and reorder future milestones |
| `/tac capture` | Fire-and-forget thought capture |
| `/tac triage` | Manually trigger capture triage |
| `/tac debug` | Create and inspect persistent /tac debug sessions |
| `/tac debug list` | List persisted debug sessions |
| `/tac debug status <slug>` | Show status for one debug session slug |
| `/tac debug continue <slug>` | Resume an existing debug session slug |
| `/tac debug --diagnose` | Inspect malformed artifacts and session health (`--diagnose [<slug> | <issue text>]`) |
| `/tac dispatch` | Dispatch a specific phase directly |
| `/tac history` | View execution history (supports `--cost`, `--phase`, `--model` filters) |
| `/tac forensics` | Full debugger for auto-mode failures (includes worktree lifecycle telemetry) |
| `/tac cleanup` | Clean up state files and stale worktrees |
| `/tac visualize` | Open workflow visualizer |
| `/tac export --html` | Generate HTML report for current milestone |
| `/tac export --html --all` | Generate reports for all milestones |
| `/tac update` | Update TAC to the latest version |
| `/tac knowledge` | Add persistent project knowledge |
| `/tac fast` | Toggle service tier for supported models |
| `/tac rate` | Rate last unit's model tier (over/ok/under) |
| `/tac changelog` | Show release notes |
| `/tac logs` | Browse activity and debug logs |
| `/tac remote` | Control remote auto-mode |
| `/tac help` | Show all available commands |

## Configuration & Diagnostics

| Command | Description |
|---------|-------------|
| `/tac prefs` | Preferences wizard |
| `/tac mode` | Switch workflow mode (solo/team) |
| `/tac config` | Re-run provider setup wizard |
| `/tac keys` | API key manager |
| `/tac doctor` | Runtime health checks with auto-fix |
| `/tac inspect` | Show database diagnostics |
| `/tac init` | Project init wizard |
| `/tac setup` | Global setup status |
| `/tac skill-health` | Skill lifecycle dashboard |
| `/tac hooks` | Show configured hooks |
| `/tac migrate` | Migrate v1 `.planning` to `.tac` format |

## Milestone Management

| Command | Description |
|---------|-------------|
| `/tac new-milestone` | Create a new milestone |
| `/tac skip` | Prevent a unit from auto-mode dispatch |
| `/tac undo` | Revert last completed unit |
| `/tac undo-task` | Reset a specific task's completion state |
| `/tac reset-slice` | Reset a slice and all its tasks |
| `/tac park` | Park a milestone (skip without deleting) |
| `/tac unpark` | Reactivate a parked milestone |

## Parallel Orchestration

| Command | Description |
|---------|-------------|
| `/tac parallel start` | Analyze and start parallel workers |
| `/tac parallel status` | Show worker state and progress |
| `/tac parallel stop [MID]` | Stop workers |
| `/tac parallel pause [MID]` | Pause workers |
| `/tac parallel resume [MID]` | Resume workers |
| `/tac parallel merge [MID]` | Merge completed milestones |

## Workflow Templates

| Command | Description |
|---------|-------------|
| `/tac start` | Start a workflow template |
| `/tac start resume` | Resume an in-progress workflow |
| `/tac templates` | List available templates |
| `/tac templates info <name>` | Show template details |

## Custom Workflows

| Command | Description |
|---------|-------------|
| `/tac workflow new` | Create a workflow definition |
| `/tac workflow run <name>` | Start a workflow run |
| `/tac workflow list` | List workflow runs |
| `/tac workflow validate <name>` | Validate a workflow YAML |
| `/tac workflow pause` | Pause workflow auto-mode |
| `/tac workflow resume` | Resume paused workflow |

## Extensions

| Command | Description |
|---------|-------------|
| `/tac extensions list` | List all extensions |
| `/tac extensions enable <id>` | Enable an extension |
| `/tac extensions disable <id>` | Disable an extension |
| `/tac extensions info <id>` | Show extension details |

## GitHub Sync

| Command | Description |
|---------|-------------|
| `/github-sync bootstrap` | Initial GitHub sync setup |
| `/github-sync status` | Show sync mapping counts |

## Session Management

| Command | Description |
|---------|-------------|
| `/clear` | Start a new session |
| `/exit` | Graceful shutdown |
| `/model` | Switch the active model |
| `/login` | Log in to an LLM provider |
| `/thinking` | Toggle thinking level |
| `/voice` | Toggle speech-to-text |
| `/worktree` (`/wt`) | Git worktree management |

## In-Session Update

```
/tac update
```

Checks npm for a newer version and installs it without leaving the session.
