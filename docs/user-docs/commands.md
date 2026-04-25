# Commands Reference

## Session Commands

| Command | Description |
|---------|-------------|
| `/tac` | Step mode — execute one unit at a time, pause between each |
| `/tac next` | Explicit step mode (same as `/tac`) |
| `/tac auto` | Autonomous mode — research, plan, execute, commit, repeat |
| `/tac quick` | Execute a quick task with TAC guarantees (atomic commits, state tracking) without full planning overhead |
| `/tac stop` | Stop auto mode gracefully |
| `/tac pause` | Pause auto-mode (preserves state, `/tac auto` to resume) |
| `/tac steer` | Hard-steer plan documents during execution |
| `/tac discuss` | Discuss architecture and decisions (works alongside auto mode) |
| `/tac status` | Progress dashboard |
| `/tac widget` | Cycle dashboard widget: full / small / min / off |
| `/tac queue` | Queue and reorder future milestones (safe during auto mode) |
| `/tac capture` | Fire-and-forget thought capture (works during auto mode) |
| `/tac triage` | Manually trigger triage of pending captures |
| `/tac debug` | Create and inspect persistent /tac debug sessions |
| `/tac debug list` | List persisted debug sessions |
| `/tac debug status <slug>` | Show status for one debug session slug |
| `/tac debug continue <slug>` | Resume an existing debug session slug |
| `/tac debug --diagnose` | Inspect malformed artifacts and session health (`--diagnose [<slug> | <issue text>]`) |
| `/tac dispatch` | Dispatch a specific phase directly (research, plan, execute, complete, reassess, uat, replan) |
| `/tac history` | View execution history (supports `--cost`, `--phase`, `--model` filters) |
| `/tac forensics` | Full-access TAC debugger — structured anomaly detection, unit traces, and LLM-guided root-cause analysis for auto-mode failures |
| `/tac cleanup` | Clean up TAC state files and stale worktrees |
| `/tac visualize` | Open workflow visualizer (progress, deps, metrics, timeline) |
| `/tac export --html` | Generate self-contained HTML report for current or completed milestone |
| `/tac export --html --all` | Generate retrospective reports for all milestones at once |
| `/tac update` | Update TAC to the latest version in-session |
| `/tac knowledge` | Add persistent project knowledge (rule, pattern, or lesson) |
| `/tac extract-learnings <MID>` | Extract structured Decisions, Lessons, Patterns, and Surprises from a completed milestone — writes `<MID>-LEARNINGS.md` audit trail, appends Patterns and Lessons to `.tac/KNOWLEDGE.md`, and persists Decisions via the DECISIONS database. Runs automatically at milestone completion. |
| `/tac fast` | Toggle service tier for supported models (prioritized API routing) |
| `/tac rate` | Rate last unit's model tier (over/ok/under) — improves adaptive routing |
| `/tac changelog` | Show categorized release notes |
| `/tac logs` | Browse activity logs, debug logs, and metrics |
| `/tac remote` | Control remote auto-mode |
| `/tac help` | Categorized command reference with descriptions for all TAC subcommands |

## Configuration & Diagnostics

| Command | Description |
|---------|-------------|
| `/tac prefs` | Model selection, timeouts, budget ceiling |
| `/tac mode` | Switch workflow mode (solo/team) with coordinated defaults for milestone IDs, git commit behavior, and documentation |
| `/tac config` | Re-run the provider setup wizard (LLM provider + tool keys) |
| `/tac keys` | API key manager — list, add, remove, test, rotate, doctor |
| `/tac doctor` | Runtime health checks with auto-fix — issues surface in real time across widget, visualizer, and HTML reports (v2.40) |
| `/tac inspect` | Show SQLite DB diagnostics |
| `/tac init` | Project init wizard — detect, configure, bootstrap `.tac/` |
| `/tac setup` | Global setup status and configuration |
| `/tac skill-health` | Skill lifecycle dashboard — usage stats, success rates, token trends, staleness warnings |
| `/tac skill-health <name>` | Detailed view for a single skill |
| `/tac skill-health --declining` | Show only skills flagged for declining performance |
| `/tac skill-health --stale N` | Show skills unused for N+ days |
| `/tac hooks` | Show configured post-unit and pre-dispatch hooks |
| `/tac run-hook` | Manually trigger a specific hook |
| `/tac migrate` | Migrate a v1 `.planning` directory to `.tac` format |

## Milestone Management

| Command | Description |
|---------|-------------|
| `/tac new-milestone` | Create a new milestone |
| `/tac skip` | Prevent a unit from auto-mode dispatch |
| `/tac undo` | Revert last completed unit |
| `/tac undo-task` | Reset a specific task's completion state (DB + markdown) |
| `/tac reset-slice` | Reset a slice and all its tasks (DB + markdown) |
| `/tac park` | Park a milestone — skip without deleting |
| `/tac unpark` | Reactivate a parked milestone |
| Discard milestone | Available via `/tac` wizard → "Milestone actions" → "Discard" |

## Parallel Orchestration

| Command | Description |
|---------|-------------|
| `/tac parallel start` | Analyze eligibility, confirm, and start workers |
| `/tac parallel status` | Show all workers with state, progress, and cost |
| `/tac parallel stop [MID]` | Stop all workers or a specific milestone's worker |
| `/tac parallel pause [MID]` | Pause all workers or a specific one |
| `/tac parallel resume [MID]` | Resume paused workers |
| `/tac parallel merge [MID]` | Merge completed milestones back to main |

See [Parallel Orchestration](./parallel-orchestration.md) for full documentation.

## Workflow Templates (v2.42)

| Command | Description |
|---------|-------------|
| `/tac start` | Start a workflow template (bugfix, spike, feature, hotfix, refactor, security-audit, dep-upgrade, full-project) |
| `/tac start resume` | Resume an in-progress workflow |
| `/tac templates` | List available workflow templates |
| `/tac templates info <name>` | Show detailed template info |

## Custom Workflows

The unified plugin system. Every workflow — bundled, user-authored, or
remotely installed — is discoverable via `/tac workflow <name>` and declares
one of four execution modes:

| Mode              | What it does                                                                              |
|-------------------|-------------------------------------------------------------------------------------------|
| `oneshot`         | Prompt-only, no state, no branch. For reviews, triage, changelog generation.              |
| `yaml-step`       | Full engine with GRAPH.yaml, iterate, and shell-verify. For fan-out batch work.           |
| `markdown-phase`  | Multi-phase with STATE.json + phase-approval gates. For release, performance audit.       |
| `auto-milestone`  | Hooks into the full `/tac auto` pipeline. Reserved for `full-project`.                    |

### Discovery order (project > global > bundled)

1. `.tac/workflows/<name>.{yaml,md}` — project-local, checked into the repo.
2. `~/.tac/workflows/<name>.{yaml,md}` — global, private to the machine.
3. Bundled — ships with TAC (see the full list with `/tac workflow`).

Legacy `.tac/workflow-defs/` YAML definitions are still picked up for
backwards compatibility.

### Commands

| Command | Description |
|---------|-------------|
| `/tac workflow` | List all discoverable plugins, grouped by mode |
| `/tac workflow <name> [args]` | Run a plugin directly (resolved via precedence chain) |
| `/tac workflow info <name>` | Show plugin metadata — source, mode, phases, path |
| `/tac workflow new` | Create a new workflow definition (via the `create-workflow` skill) |
| `/tac workflow install <source>` | Install a plugin from `https://...`, `gist:<id>`, or `gh:owner/repo/path[@ref]` |
| `/tac workflow uninstall <name>` | Remove an installed plugin and its provenance record |
| `/tac workflow run <name> [k=v]` | Explicit YAML run form (same as `/tac workflow <name>` for yaml-step plugins) |
| `/tac workflow list` | List YAML workflow runs (history) |
| `/tac workflow validate <name>` | Validate a YAML definition |
| `/tac workflow pause` | Pause custom workflow auto-mode |
| `/tac workflow resume` | Resume paused custom workflow auto-mode |

### Bundled plugins

- **Phased (`markdown-phase`)**: `bugfix`, `small-feature`, `spike`, `hotfix`,
  `refactor`, `security-audit`, `dep-upgrade`, `release`, `api-breaking-change`,
  `performance-audit`, `observability-setup`, `ci-bootstrap`.
- **Oneshot**: `pr-review`, `changelog-gen`, `issue-triage`, `pr-triage`,
  `onboarding-check`, `dead-code`, `accessibility-audit`.
- **YAML engine (`yaml-step`)**: `test-backfill`, `docs-sync`, `rename-symbol`,
  `env-audit`.
- **Auto-milestone**: `full-project` (reached via `/tac start full-project` or
  `/tac auto`).

### Authoring a custom plugin

Run `/tac workflow new <name>` to scaffold via the `create-workflow` skill.
Plugins are plain YAML (`.yaml`) or markdown (`.md`) files. See
`src/resources/extensions/tac/workflow-templates/` for bundled examples.

## Extensions

| Command | Description |
|---------|-------------|
| `/tac extensions list` | List all extensions and their status |
| `/tac extensions enable <id>` | Enable a disabled extension |
| `/tac extensions disable <id>` | Disable an extension |
| `/tac extensions info <id>` | Show extension details |

## cmux Integration

| Command | Description |
|---------|-------------|
| `/tac cmux status` | Show cmux detection, prefs, and capabilities |
| `/tac cmux on` | Enable cmux integration |
| `/tac cmux off` | Disable cmux integration |
| `/tac cmux notifications on/off` | Toggle cmux desktop notifications |
| `/tac cmux sidebar on/off` | Toggle cmux sidebar metadata |
| `/tac cmux splits on/off` | Toggle cmux visual subagent splits |

## GitHub Sync (v2.39)

| Command | Description |
|---------|-------------|
| `/github-sync bootstrap` | Initial setup — creates GitHub Milestones, Issues, and draft PRs from current `.tac/` state |
| `/github-sync status` | Show sync mapping counts (milestones, slices, tasks) |

Enable with `github.enabled: true` in preferences. Requires `gh` CLI installed and authenticated. Sync mapping is persisted in `.tac/.github-sync.json`.

## Git Commands

| Command | Description |
|---------|-------------|
| `/worktree` (`/wt`) | Git worktree lifecycle — create, switch, merge, remove |

## Telegram Commands

The following commands are sent directly in your **Telegram chat** to a configured TAC bot — they are not TAC CLI commands. Telegram command polling runs every ~5 seconds while auto-mode is active. Each response is prefixed with the project name (e.g., `📁 MyProject`).

| Command | Description |
|---------|-------------|
| `/status` | Current milestone, active unit, and session cost |
| `/progress` | Roadmap overview — completed and open milestones |
| `/budget` | Token usage and cost for the current session |
| `/pause` | Pause auto-mode after the current unit finishes |
| `/resume` | Clear a pause directive and continue auto-mode |
| `/log [n]` | Last `n` activity log entries (default: 5) |
| `/help` | List all available Telegram commands |

**Requirements:** Telegram must be configured as your remote channel (`remote_questions.channel: telegram`). Commands are only processed while auto-mode is running. See [Remote Questions — Telegram Commands](./remote-questions.md#telegram-commands) for setup and details.

## Session Management

| Command | Description |
|---------|-------------|
| `/clear` | Start a new session (alias for `/new`) |
| `/exit` | Graceful shutdown — saves session state before exiting |
| `/kill` | Kill TAC process immediately |
| `/model` | Switch the active model |
| `/login` | Log in to an LLM provider |
| `/thinking` | Toggle thinking level during sessions |
| `/voice` | Toggle real-time speech-to-text (macOS, Linux) |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+G` | Toggle dashboard overlay |
| `Ctrl+Alt+V` | Toggle voice transcription |
| `Ctrl+Alt+B` | Show background shell processes |
| `Ctrl+V` / `Alt+V` | Paste image from clipboard (screenshot → vision input) |
| `Escape` | Pause auto mode (preserves conversation) |

> **Note:** In terminals without Kitty keyboard protocol support (macOS Terminal.app, JetBrains IDEs), slash-command fallbacks are shown instead of `Ctrl+Alt` shortcuts.
>
> **Tip:** If `Ctrl+V` is intercepted by your terminal (e.g. Warp), use `Alt+V` instead for clipboard image paste.

## CLI Flags

| Flag | Description |
|------|-------------|
| `tac` | Start a new interactive session |
| `tac --continue` (`-c`) | Resume the most recent session for the current directory |
| `tac --model <id>` | Override the default model for this session |
| `tac --print "msg"` (`-p`) | Single-shot prompt mode (no TUI) |
| `tac --mode <text\|json\|rpc\|mcp>` | Output mode for non-interactive use |
| `tac --list-models [search]` | List available models and exit |
| `tac --web [path]` | Start browser-based web interface (optional project path) |
| `tac --worktree` (`-w`) [name] | Start session in a git worktree (auto-generates name if omitted) |
| `tac --no-session` | Disable session persistence |
| `tac --extension <path>` | Load an additional extension (can be repeated) |
| `tac --append-system-prompt <text>` | Append text to the system prompt |
| `tac --tools <list>` | Comma-separated list of tools to enable |
| `tac --version` (`-v`) | Print version and exit |
| `tac --help` (`-h`) | Print help and exit |
| `tac sessions` | Interactive session picker — list all saved sessions for the current directory and choose one to resume |
| `tac --debug` | Enable structured JSONL diagnostic logging for troubleshooting dispatch and state issues |
| `tac config` | Set up global API keys for search and docs tools (saved to `~/.tac/agent/auth.json`, applies to all projects). See [Global API Keys](./configuration.md#global-api-keys-tac-config). |
| `tac update` | Update TAC to the latest version |
| `tac headless new-milestone` | Create a new milestone from a context file (headless — no TUI required) |

## Headless Mode

`tac headless` runs `/tac` commands without a TUI — designed for CI, cron jobs, and scripted automation. It spawns a child process in RPC mode, auto-responds to interactive prompts, detects completion, and exits with meaningful exit codes.

```bash
# Run auto mode (default)
tac headless

# Run a single unit
tac headless next

# Instant JSON snapshot — no LLM, ~50ms
tac headless query

# With timeout for CI
tac headless --timeout 600000 auto

# Force a specific phase
tac headless dispatch plan

# Create a new milestone from a context file and start auto mode
tac headless new-milestone --context brief.md --auto

# Create a milestone from inline text
tac headless new-milestone --context-text "Build a REST API with auth"

# Pipe context from stdin
echo "Build a CLI tool" | tac headless new-milestone --context -
```

| Flag | Description |
|------|-------------|
| `--timeout N` | Overall timeout in milliseconds (default: 300000 / 5 min) |
| `--max-restarts N` | Auto-restart on crash with exponential backoff (default: 3). Set 0 to disable |
| `--json` | Stream all events as JSONL to stdout |
| `--model ID` | Override the model for the headless session |
| `--context <file>` | Context file for `new-milestone` (use `-` for stdin) |
| `--context-text <text>` | Inline context text for `new-milestone` |
| `--auto` | Chain into auto-mode after milestone creation |

**Exit codes:** `0` = complete, `1` = error or timeout, `2` = blocked.

Any `/tac` subcommand works as a positional argument — `tac headless status`, `tac headless doctor`, `tac headless dispatch execute`, etc.

### `tac headless query`

Returns a single JSON object with the full project snapshot — no LLM session, no RPC child, instant response (~50ms). This is the recommended way for orchestrators and scripts to inspect TAC state.

```bash
tac headless query | jq '.state.phase'
# "executing"

tac headless query | jq '.next'
# {"action":"dispatch","unitType":"execute-task","unitId":"M001/S01/T03"}

tac headless query | jq '.cost.total'
# 4.25
```

**Output schema:**

```json
{
  "state": {
    "phase": "executing",
    "activeMilestone": { "id": "M001", "title": "..." },
    "activeSlice": { "id": "S01", "title": "..." },
    "activeTask": { "id": "T01", "title": "..." },
    "registry": [{ "id": "M001", "status": "active" }, ...],
    "progress": { "milestones": { "done": 0, "total": 2 }, "slices": { "done": 1, "total": 3 } },
    "blockers": []
  },
  "next": {
    "action": "dispatch",
    "unitType": "execute-task",
    "unitId": "M001/S01/T01"
  },
  "cost": {
    "workers": [{ "milestoneId": "M001", "cost": 1.50, "state": "running", ... }],
    "total": 1.50
  }
}
```

## MCP Server Mode

`tac --mode mcp` runs TAC as a [Model Context Protocol](https://modelcontextprotocol.io) server over stdin/stdout. This exposes all TAC tools (read, write, edit, bash, etc.) to external AI clients — Claude Desktop, VS Code Copilot, and any MCP-compatible host.

```bash
# Start TAC as an MCP server
tac --mode mcp
```

The server registers all tools from the agent session and maps MCP `tools/list` and `tools/call` requests to TAC tool definitions. It runs until the transport closes.

## In-Session Update

`/tac update` checks npm for a newer version of TAC and installs it without leaving the session.

```bash
/tac update
# Current version: v2.36.0
# Checking npm registry...
# Updated to v2.37.0. Restart TAC to use the new version.
```

If already up to date, it reports so and takes no action.

## Export

`/tac export` generates reports of milestone work.

```bash
# Generate HTML report for the active milestone
/tac export --html

# Generate retrospective reports for ALL milestones at once
/tac export --html --all
```

Reports are saved to `.tac/reports/` with a browseable `index.html` that links to all generated snapshots.
