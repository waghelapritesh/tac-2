# Debug Sessions

`/tac debug` creates persistent debug sessions so you can investigate an issue across multiple turns without losing state.

## Quick Start

```bash
# Start a standard debug session (find + fix)
/tac debug checkout returns 500 after login

# List all saved sessions
/tac debug list

# Inspect one session
/tac debug status checkout-returns-500-after-login

# Resume one session
/tac debug continue checkout-returns-500-after-login

# Diagnose store health (all sessions)
/tac debug --diagnose

# Diagnose one known session
/tac debug --diagnose checkout-returns-500-after-login

# Start diagnose-only root-cause mode (no fix dispatch)
/tac debug --diagnose checkout still returns 500 after oauth refresh
```

> **Note:** Debug artifacts are persisted at `.tac/debug/sessions/<slug>.json`, so sessions survive across turns and can be resumed later.

## How It Works

`/tac debug` parsing is strict for reserved subcommands (`list`, `status`, `continue`, `--diagnose`) and intentionally falls back to issue text when syntax is ambiguous.

- `list` is only treated as a subcommand when used exactly as `/tac debug list`.
  - Example: `/tac debug list flaky checkout retries` starts a new session with that full issue text.
- `status` and `continue` require exactly one valid `<slug>` argument.
  - Missing slug emits warnings:
    - `Missing slug. Usage: /tac debug status <slug>`
    - `Missing slug. Usage: /tac debug continue <slug>`
  - Any non-strict form (extra words, invalid slug shape) falls back to a normal issue-start session.
- `--diagnose` has dedicated modes:
  - `/tac debug --diagnose` → store health diagnostics (malformed artifact counts + remediation hints)
  - `/tac debug --diagnose <slug>` → targeted diagnostics for one session
  - `/tac debug --diagnose <issue text>` (multi-token) → starts a new session in `mode=diagnose` with root-cause-only intent
- `/tac debug --diagnose <single-non-slug-token>` is invalid and returns:
  - `Invalid diagnose target. Usage: /tac debug --diagnose [<slug> | <issue text>]`

Unknown debug flags (for example `/tac debug --wat`) return an explicit warning plus usage text.

## Subcommands

| Command | Behavior |
|---------|----------|
| `/tac debug <issue-text>` | Start a new persistent debug session with `mode=debug` and actionable next steps (`status` / `continue`). |
| `/tac debug list` | List healthy sessions plus malformed artifacts discovered under `.tac/debug/sessions/`. |
| `/tac debug status <slug>` | Show one session's mode, status, phase, issue, artifact path, log path, update time, and `lastError`. |
| `/tac debug continue <slug>` | Resume an existing session and dispatch the next debug workflow turn unless the session is already resolved. |

## Flags

| Flag syntax | Behavior |
|-------------|----------|
| `/tac debug --diagnose` | Run zero-argument health diagnostics over all debug session artifacts. |
| `/tac debug --diagnose <slug>` | Diagnose one existing session and report targeted metadata. |
| `/tac debug --diagnose <issue text>` | Start a new diagnose-only session (`mode=diagnose`) to find root cause without immediate fix dispatch. |

## Examples

### Start a session

```bash
/tac debug auth token expires after refresh
```

### List sessions

```bash
/tac debug list
```

### Check status

```bash
/tac debug status auth-token-expires-after-refresh
```

### Continue

```bash
/tac debug continue auth-token-expires-after-refresh
```

### Diagnose-only flows

```bash
# Global artifact health
/tac debug --diagnose

# One existing session
/tac debug --diagnose auth-token-expires-after-refresh

# New root-cause-only session (multi-word issue required)
/tac debug --diagnose auth token still expires on safari
```

> **Note:** If a session slug is unknown, status/continue/targeted diagnose commands warn and recommend `/tac debug list`.
