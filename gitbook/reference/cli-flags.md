# CLI Flags

## Starting TAC

| Flag | Description |
|------|-------------|
| `tac` | Start a new interactive session |
| `tac --continue` (`-c`) | Resume the most recent session |
| `tac --model <id>` | Override the default model for this session |
| `tac --web [path]` | Start browser-based web interface |
| `tac --worktree` (`-w`) [name] | Start in a git worktree |
| `tac --no-session` | Disable session persistence |
| `tac --extension <path>` | Load an additional extension (repeatable) |
| `tac --append-system-prompt <text>` | Append text to the system prompt |
| `tac --tools <list>` | Comma-separated tools to enable |
| `tac --version` (`-v`) | Print version and exit |
| `tac --help` (`-h`) | Print help and exit |
| `tac --debug` | Enable diagnostic logging |

## Non-Interactive Modes

| Flag | Description |
|------|-------------|
| `tac --print "msg"` (`-p`) | Single-shot prompt mode (no TUI) |
| `tac --mode <text\|json\|rpc\|mcp>` | Output mode for non-interactive use |

## Session Management

| Command | Description |
|---------|-------------|
| `tac sessions` | Interactive session picker — list and resume saved sessions |
| `tac --list-models [search]` | List available models and exit |

## Configuration

| Command | Description |
|---------|-------------|
| `tac config` | Set up global API keys |
| `tac update` | Update to the latest version |

## Headless Mode

| Flag | Description |
|------|-------------|
| `tac headless` | Run without TUI |
| `tac headless --timeout N` | Timeout in ms (default: 300000) |
| `tac headless --max-restarts N` | Auto-restart on crash (default: 3) |
| `tac headless --json` | Stream events as JSONL |
| `tac headless --model ID` | Override model |
| `tac headless --context <file>` | Context file for `new-milestone` |
| `tac headless --context-text <text>` | Inline context for `new-milestone` |
| `tac headless --auto` | Chain into auto mode after milestone creation |
| `tac headless query` | Instant JSON state snapshot (~50ms) |

## Web Interface

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `localhost` | Bind address |
| `--port` | `3000` | Port |
| `--allowed-origins` | (none) | CORS origins |
