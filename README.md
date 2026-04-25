# TAC — Think. Architect. Code.

AI-native development CLI with full TUI dashboard, multi-provider support, and wave-based parallel agents.

Based on [GSD-2](https://github.com/gsd-build/gsd-2) (MIT License, by Lex Christopherson).

## Install

```bash
npm install -g tac-2
```

After install, the `tac` command is available globally. On systems where `tac` conflicts with GNU coreutils, use `tac-cli` instead.

## First Run

```bash
tac                      # Launch interactive TUI — setup wizard runs on first use
```

The setup wizard will ask for your AI provider and API key.

## Usage

```bash
tac                      # Interactive TUI
tac new "idea"           # Full pipeline: ASK > DESIGN > SAFE > AUTO > SHIP
tac build "feature"      # Smart build (skips Q&A if request is clear)
tac think "idea"         # Explore only (ASK + DESIGN, no coding)
tac go                   # Resume from checkpoint
tac ship                 # Safety check + PR + review
tac dashboard            # Live progress TUI
tac status               # Current progress
tac config               # Re-run setup wizard
```

## Features

- **Multi-provider** — Claude, OpenAI, Gemini, Ollama, OpenAI-compatible
- **Full TUI dashboard** — Live progress, agent status, cost tracking
- **Wave-based agents** — Parallel execution with TDD enforcement
- **7 built-in tools** — Read, Write, Edit, Bash, Glob, Grep, Git
- **Pipeline stages** — ASK > DESIGN > SAFE > AUTO > SHIP
- **Crash recovery** — Heartbeat + stuck detection + auto-resume
- **Cost tracking** — Real token counting per feature
- **Extensions** — Pluggable extension system

## Supported Providers

| Provider | Models |
|----------|--------|
| Anthropic | Claude Opus, Sonnet, Haiku |
| OpenAI | GPT-4o, o1, o3 |
| Google | Gemini 2.5 Pro, Flash |
| Ollama | Any local model |
| OpenAI-compatible | Any compatible API |

## Requirements

- Node.js >= 22
- An AI provider API key

## License

MIT — Based on GSD-2 by Lex Christopherson
