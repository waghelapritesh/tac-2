# Step-by-Step Execution

Run TAC one unit at a time with decision points between steps. Use this when you need
control over execution — budget enforcement, progress reporting, conditional logic,
or the ability to steer mid-build.

## When to use this vs `auto`

| Approach | Use when |
|----------|----------|
| `auto` | You trust the build, just want the result |
| `next` loop | You need budget checks, progress updates, or intervention points |

## Core Loop

```bash
cd /path/to/project
MAX_BUDGET=20.00
TOTAL_COST=0

while true; do
  # Run one unit
  RESULT=$(tac headless --output-format json next 2>/dev/null)
  EXIT=$?

  # Parse result
  STATUS=$(echo "$RESULT" | jq -r '.status')
  STEP_COST=$(echo "$RESULT" | jq -r '.cost.total')
  PHASE=$(echo "$RESULT" | jq -r '.phase // empty')
  SESSION_ID=$(echo "$RESULT" | jq -r '.sessionId // empty')

  # Handle exit codes
  case $EXIT in
    0) ;; # success — continue
    1)
      echo "Step failed: $STATUS"
      break
      ;;
    10)
      echo "Blocked — needs intervention"
      tac headless query | jq '.state'
      break
      ;;
    11)
      echo "Cancelled"
      break
      ;;
  esac

  # Check if milestone complete
  CURRENT_PHASE=$(tac headless query | jq -r '.state.phase')
  if [ "$CURRENT_PHASE" = "complete" ]; then
    TOTAL_COST=$(tac headless query | jq -r '.cost.total')
    echo "Milestone complete. Total cost: \$$TOTAL_COST"
    break
  fi

  # Budget check
  TOTAL_COST=$(tac headless query | jq -r '.cost.total')
  OVER=$(echo "$TOTAL_COST > $MAX_BUDGET" | bc -l)
  if [ "$OVER" = "1" ]; then
    echo "Budget limit (\$$MAX_BUDGET) exceeded at \$$TOTAL_COST"
    tac headless stop
    break
  fi

  # Progress report
  PROGRESS=$(tac headless query | jq -r '"\(.state.progress.tasks.done)/\(.state.progress.tasks.total) tasks"')
  echo "Step done ($STATUS). Phase: $CURRENT_PHASE, Progress: $PROGRESS, Cost: \$$TOTAL_COST"
done
```

## Step-by-Step with Spec Creation

Complete flow from idea to working code with full control:

```bash
# 1. Setup
PROJECT_DIR="/tmp/my-project"
mkdir -p "$PROJECT_DIR" && cd "$PROJECT_DIR" && git init 2>/dev/null

# 2. Write spec
cat > spec.md << 'SPEC'
[Your spec here]
SPEC

# 3. Create the milestone (planning only, no execution)
RESULT=$(tac headless --output-format json --context spec.md new-milestone 2>/dev/null)
EXIT=$?

if [ $EXIT -ne 0 ]; then
  echo "Milestone creation failed"
  echo "$RESULT" | jq .
  exit 1
fi

echo "Milestone created. Starting execution..."

# 4. Execute step-by-step
STEP=0
while true; do
  STEP=$((STEP + 1))
  RESULT=$(tac headless --output-format json next 2>/dev/null)
  EXIT=$?

  [ $EXIT -ne 0 ] && break

  PHASE=$(tac headless query | jq -r '.state.phase')
  COST=$(tac headless query | jq -r '.cost.total')

  echo "Step $STEP complete. Phase: $PHASE, Cost: \$$COST"

  [ "$PHASE" = "complete" ] && break
done

echo "Build finished in $STEP steps"
```

## Intervention Patterns

### Steer mid-execution

If you detect the build going in the wrong direction:

```bash
# Check what's happening
tac headless query | jq '{phase: .state.phase, task: .state.activeTask}'

# Redirect
tac headless steer "Use SQLite instead of PostgreSQL for storage"

# Continue
tac headless --output-format json next 2>/dev/null
```

### Skip a stuck unit

```bash
tac headless skip
tac headless --output-format json next 2>/dev/null
```

### Undo last completed unit

```bash
tac headless undo --force
tac headless --output-format json next 2>/dev/null
```

### Force a specific phase

```bash
tac headless dispatch replan   # Re-plan the current slice
tac headless dispatch execute  # Skip to execution
tac headless dispatch uat      # Jump to user acceptance testing
```
