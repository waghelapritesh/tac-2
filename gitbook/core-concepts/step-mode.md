# Step Mode

Step mode is TAC's interactive, one-step-at-a-time workflow. You stay in the loop, reviewing output between each step.

## Starting Step Mode

```
/tac
```

TAC reads the state of your `.tac/` directory and presents a wizard showing what's completed and what's next. It then executes one unit of work and pauses.

## How It Works

Step mode adapts to your project's current state:

| State | What Happens |
|-------|-------------|
| No `.tac/` directory | Starts a discussion flow to capture your project vision |
| Milestone exists, no roadmap | Opens a discussion or research phase for the milestone |
| Roadmap exists, slices pending | Plans the next slice or executes the next task |
| Mid-task | Resumes where you left off |

After each unit completes, you see results and decide what to do next. This is ideal for:

- New projects where you want to shape the architecture
- Critical work where you want to review each step
- Learning how TAC works before trusting auto mode

## Steering During Step Mode

Between steps, you can:

- **Discuss** — `/tac discuss` to talk through architecture decisions
- **Skip** — `/tac skip` to prevent a unit from being dispatched
- **Undo** — `/tac undo` to revert the last completed unit
- **Switch to auto** — `/tac auto` to let TAC continue autonomously

## When to Use Step Mode

- **First milestone** — Review TAC's work before trusting it to run solo
- **Architectural decisions** — When you want to guide the approach
- **Unfamiliar codebases** — When you want to ensure TAC understands the project
- **High-stakes changes** — When mistakes would be costly

## Transitioning to Auto Mode

Once you're comfortable with TAC's approach, switch to auto mode:

```
/tac auto
```

You can always press **Escape** to pause auto mode and return to step-by-step control.
