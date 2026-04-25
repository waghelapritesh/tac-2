# Multi-Session Orchestration

How to run and monitor multiple concurrent TAC sessions.

## Architecture

TAC uses **file-based IPC** — no sockets or ports. All coordination happens through JSON files in `.tac/parallel/`.

```
.tac/parallel/
├── M001.status.json    # Worker heartbeat + state
├── M001.signal.json    # Coordinator → worker commands (ephemeral)
├── M002.status.json
├── M003.status.json
└── ...
```

## Worker Isolation

Each worker gets:
1. **`TAC_MILESTONE_LOCK=M00X`** — state derivation only sees this milestone
2. **`TAC_PARALLEL_WORKER=1`** — prevents nested parallel spawns
3. **Own git worktree** at `.tac/worktrees/M00X/` — branch `milestone/M00X`

Workers cannot interfere with each other. Each has its own filesystem and git branch.

## Status File Schema

Written atomically (`.tmp` + rename) by each worker at `.tac/parallel/<milestoneId>.status.json`:

```json
{
  "milestoneId": "M001",
  "pid": 12345,
  "state": "running",
  "currentUnit": {
    "type": "task",
    "id": "T03",
    "startedAt": 1710000000000
  },
  "completedUnits": 7,
  "cost": 1.23,
  "lastHeartbeat": 1710000015000,
  "startedAt": 1710000000000,
  "worktreePath": ".tac/worktrees/M001"
}
```

**States:** `running`, `paused`, `stopped`, `error`

## Signal Files

Coordinator writes to `.tac/parallel/<milestoneId>.signal.json`. Worker consumes and deletes on next dispatch cycle.

```json
{
  "signal": "pause",
  "sentAt": 1710000020000,
  "from": "coordinator"
}
```

**Signals:** `pause`, `resume`, `stop`, `rebase`

## Spawning Workers

```bash
# Spawn worker in its worktree
TAC_MILESTONE_LOCK=M001 \
TAC_PARALLEL_WORKER=1 \
  tac headless --json auto 2>logs/M001.log &
WORKER_PID=$!
```

Workers emit JSONL events on stdout when `--json` is set.

## Monitoring All Workers

```bash
# Dashboard: enumerate all status files
for f in .tac/parallel/*.status.json; do
  [ -f "$f" ] || continue
  jq -r '[.milestoneId, .state, (.currentUnit.id // "idle"), "\(.cost | tostring)$"] | join("\t")' "$f"
done

# Liveness check
for f in .tac/parallel/*.status.json; do
  PID=$(jq -r '.pid' "$f")
  MID=$(jq -r '.milestoneId' "$f")
  if kill -0 "$PID" 2>/dev/null; then
    echo "$MID: alive (pid=$PID)"
  else
    echo "$MID: DEAD (pid=$PID) — cleanup needed"
    rm "$f"
  fi
done
```

## Sending Commands

```bash
# Pause a worker
send_signal() {
  local MID=$1 SIGNAL=$2
  echo "{\"signal\":\"$SIGNAL\",\"sentAt\":$(date +%s000),\"from\":\"coordinator\"}" \
    > ".tac/parallel/${MID}.signal.json"
}

send_signal M001 pause
send_signal M002 stop
send_signal M003 resume
```

## Budget Enforcement

Use `tac headless query` for instant aggregate cost:
```bash
TOTAL=$(tac headless query | jq -r '.cost.total')
CEILING=50.00
if (( $(echo "$TOTAL > $CEILING" | bc -l) )); then
  echo "Budget exceeded ($TOTAL > $CEILING) — stopping all"
  for f in .tac/parallel/*.status.json; do
    MID=$(jq -r '.milestoneId' "$f")
    send_signal "$MID" stop
  done
fi
```

## Stale Session Cleanup

A session is stale when:
- PID is dead (`kill -0 $pid` fails), OR
- `lastHeartbeat` is older than 30 seconds

```bash
NOW=$(date +%s000)
STALE_THRESHOLD=30000
for f in .tac/parallel/*.status.json; do
  PID=$(jq -r '.pid' "$f")
  HB=$(jq -r '.lastHeartbeat' "$f")
  AGE=$((NOW - HB))
  if ! kill -0 "$PID" 2>/dev/null || [ "$AGE" -gt "$STALE_THRESHOLD" ]; then
    echo "Stale: $(jq -r '.milestoneId' "$f") — removing"
    rm "$f"
  fi
done
```

## Multi-Project Orchestration

Within one project, milestones are tracked automatically in `.tac/parallel/`. For orchestrating across **multiple projects**, maintain an external registry:

```json
{
  "sessions": [
    { "project": "/path/to/project-a", "milestoneId": "M001" },
    { "project": "/path/to/project-b", "milestoneId": "M001" },
    { "project": "/path/to/project-b", "milestoneId": "M002" }
  ]
}
```

Then poll each project's `.tac/parallel/` directory. TAC has no cross-project awareness — the orchestrator must bridge this gap.

## Built-in Parallel Commands

Inside an interactive TAC session, these commands manage the parallel orchestrator:

| Command | Description |
|---------|-------------|
| `/tac parallel start` | Analyze eligibility, spawn workers |
| `/tac parallel status` | Show all workers, costs, progress |
| `/tac parallel stop [MID]` | Stop one or all workers |
| `/tac parallel pause [MID]` | Pause without killing |
| `/tac parallel resume [MID]` | Resume paused worker |
| `/tac parallel merge [MID]` | Merge completed milestone branch |
