# recover-tac-1364.ps1 - Recovery script for issue #1364 (Windows)
#
# CRITICAL DATA-LOSS BUG: TAC versions 2.30.0-2.35.x unconditionally added
# ".tac" to .gitignore via ensureGitignore(), causing git to report all
# tracked .tac/ files as deleted. Fixed in v2.36.0 (PR #1367).
#
# This script:
#   1. Detects whether the repo was affected
#   2. Finds the last clean commit before the damage
#   3. Restores all deleted .tac/ files from that commit
#   4. Removes the bad ".tac" line from .gitignore (if .tac/ is tracked)
#   5. Prints a ready-to-commit summary
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\recover-tac-1364.ps1 [-DryRun]
#
# Options:
#   -DryRun   Show what would be done without making any changes
#
# Requirements: git >= 2.x, PowerShell >= 5.1, Git for Windows

[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Info    { param($msg) Write-Host "[info]  $msg" -ForegroundColor Cyan }
function Write-Ok      { param($msg) Write-Host "[ok]    $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[warn]  $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[error] $msg" -ForegroundColor Red }
function Write-Section { param($msg) Write-Host "`n$msg" -ForegroundColor White }

function Exit-Fatal {
    param($msg)
    Write-Err $msg
    exit 1
}

function Invoke-Git {
    param([string[]]$Args, [switch]$AllowFailure)
    try {
        $result = & git @Args 2>&1
        if ($LASTEXITCODE -ne 0) {
            if ($AllowFailure) { return "" }
            throw "git $($Args -join ' ') exited $LASTEXITCODE"
        }
        return ($result -join "`n").Trim()
    } catch {
        if ($AllowFailure) { return "" }
        throw
    }
}

# Run or dry-run a git command
function Invoke-GitOrDryRun {
    param([string[]]$GitArgs, [string]$Display)
    if ($DryRun) {
        Write-Host "  (dry-run) git $Display" -ForegroundColor Yellow
    } else {
        Invoke-Git $GitArgs | Out-Null
    }
}

# Check whether a path is a symlink OR a junction (Windows uses junctions for
# the .tac external-state migration via symlinkSync(..., "junction"))
function Test-ReparsePoint {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if (-not $item) { return $false }
    # LinkType covers: SymbolicLink, Junction, HardLink
    return ($item.LinkType -eq 'SymbolicLink' -or $item.LinkType -eq 'Junction')
}

# ── Preflight ─────────────────────────────────────────────────────────────────

Write-Section "── Preflight ───────────────────────────────────────────────────────"

# Verify git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Exit-Fatal "git not found on PATH. Install Git for Windows from https://git-scm.com"
}

# Must be run from inside a git repo
$gitDirCheck = & git rev-parse --git-dir 2>&1
if ($LASTEXITCODE -ne 0) {
    Exit-Fatal "Not inside a git repository. Run this from your project root."
}

$repoRoot = Invoke-Git @('rev-parse', '--show-toplevel')
Set-Location $repoRoot
Write-Info "Repo root: $repoRoot"

if ($DryRun) {
    Write-Warn "DRY-RUN mode — no changes will be made."
}

# ── Step 1: Detect .tac/ ─────────────────────────────────────────────────────

Write-Section "── Step 1: Detect .tac/ directory ─────────────────────────────────"

$tacDir = Join-Path $repoRoot '.tac'
$TacIsSymlink = $false

if (-not (Test-Path $tacDir)) {
    Write-Ok ".tac/ does not exist in this repo — not affected."
    exit 0
}

if (Test-ReparsePoint $tacDir) {
    # Scenario C: migration succeeded (symlink/junction in place) but git index was never
    # cleaned — tracked .tac/* files still appear as deleted through the reparse point.
    $TacIsSymlink = $true
    Write-Warn ".tac/ is a symlink/junction — checking for stale git index entries (Scenario C)..."
} else {
    Write-Info ".tac/ is a real directory (Scenario A/B)."
}

# ── Step 2: Check .gitignore for .tac entry ──────────────────────────────────

Write-Section "── Step 2: Check .gitignore for .tac entry ─────────────────────────"

$gitignorePath = Join-Path $repoRoot '.gitignore'

if (-not (Test-Path $gitignorePath) -and -not $TacIsSymlink) {
    Write-Ok ".gitignore does not exist — not affected."
    exit 0
}

$gitignoreLines = @()
$tacIgnoreLine  = $null
if (Test-Path $gitignorePath) {
    $gitignoreLines = Get-Content $gitignorePath -Encoding UTF8
    $tacIgnoreLine  = $gitignoreLines | Where-Object {
        $trimmed = $_.Trim()
        $trimmed -eq '.tac' -and -not $trimmed.StartsWith('#')
    } | Select-Object -First 1
}

if ($TacIsSymlink) {
    # Symlink layout: .tac SHOULD be ignored (it's external state).
    if (-not $tacIgnoreLine) {
        Write-Warn '".tac" missing from .gitignore — will add (migration complete, .tac/ is external).'
    } else {
        Write-Ok '".tac" already in .gitignore — correct for external-state layout.'
    }
} else {
    # Real-directory layout: .tac should NOT be ignored.
    if (-not $tacIgnoreLine) {
        Write-Ok '".tac" not found in .gitignore — .gitignore not affected.'
    } else {
        Write-Warn '".tac" found in .gitignore — this is the bad pattern from #1364.'
    }
}

# ── Step 3: Find deleted .tac/ files ─────────────────────────────────────────

Write-Section "── Step 3: Find deleted .tac/ files ───────────────────────────────"

# Files deleted in working tree (tracked but missing)
$deletedRaw = Invoke-Git @('ls-files', '--deleted', '--', '.tac/*') -AllowFailure
$deletedFiles = if ($deletedRaw) { $deletedRaw -split "`n" | Where-Object { $_ } } else { @() }

# Files tracked in HEAD right now
$trackedInHeadRaw = Invoke-Git @('ls-tree', '-r', '--name-only', 'HEAD', '--', '.tac/') -AllowFailure
$trackedInHead = if ($trackedInHeadRaw) { $trackedInHeadRaw -split "`n" | Where-Object { $_ } } else { @() }

$deletedFromHistory = @()
if ($TacIsSymlink) {
    # Scenario C: migration succeeded. Files are safe via reparse point.
    # Only index entries can be stale — no need to scan commit history.
    if ($trackedInHead.Count -eq 0 -and $deletedFiles.Count -eq 0) {
        Write-Ok "No stale index entries found — symlink/junction layout is healthy."
        if (-not $tacIgnoreLine) {
            Write-Info "Add .tac to .gitignore manually to complete the migration."
        }
        exit 0
    }
    $indexCount = if ($trackedInHead.Count -gt 0) { $trackedInHead.Count } else { $deletedFiles.Count }
    Write-Warn "Scenario C: $indexCount .tac/ file(s) tracked in git index but inaccessible through reparse point."
    Write-Info "Files are safe in external storage — only the git index needs cleaning."
} else {
    # Files deleted in committed history (post-commit damage scenario — Scenario B)
    $deletedHistoryRaw = Invoke-Git @('log', '--all', '--diff-filter=D', '--name-only', '--format=', '--', '.tac/*') -AllowFailure
    $deletedFromHistory = if ($deletedHistoryRaw) {
        $deletedHistoryRaw -split "`n" | Where-Object { $_ -match '^\.tac' } | Sort-Object -Unique
    } else { @() }

    # Nothing was ever tracked in any scenario
    if ($trackedInHead.Count -eq 0 -and $deletedFiles.Count -eq 0 -and $deletedFromHistory.Count -eq 0) {
        Write-Ok "No .tac/ files tracked in this repo — not affected by #1364."
        if ($tacIgnoreLine) {
            Write-Warn '".tac" is still in .gitignore but there is nothing to restore.'
        }
        exit 0
    }

    # Determine scenario
    if ($trackedInHead.Count -gt 0) {
        Write-Info "Scenario A: $($trackedInHead.Count) .tac/ files still tracked in HEAD."
    } elseif ($deletedFromHistory.Count -gt 0) {
        Write-Warn "Scenario B: $($deletedFromHistory.Count) .tac/ file(s) were tracked but deleted in a committed change:"
        $deletedFromHistory | Select-Object -First 20 | ForEach-Object { Write-Host "    - $_" }
        if ($deletedFromHistory.Count -gt 20) {
            Write-Host "    ... and $($deletedFromHistory.Count - 20) more"
        }
    }

    if ($deletedFiles.Count -gt 0) {
        Write-Warn "$($deletedFiles.Count) .tac/ file(s) are missing from working tree (tracked but deleted/gitignored):"
        $deletedFiles | Select-Object -First 20 | ForEach-Object { Write-Host "    - $_" }
        if ($deletedFiles.Count -gt 20) {
            Write-Host "    ... and $($deletedFiles.Count - 20) more"
        }
    }

    # HEAD has files and working tree is clean — only .gitignore needs fixing
    if ($trackedInHead.Count -gt 0 -and $deletedFiles.Count -eq 0) {
        if (-not $tacIgnoreLine) {
            Write-Ok "No action needed — .tac/ is tracked in HEAD and .gitignore is clean."
            exit 0
        }
        Write-Info ".tac/ is tracked in HEAD and working tree is clean — only .gitignore needs fixing."
    }
}

# ── Step 4: Find last clean commit (Scenario A/B only) ───────────────────────

Write-Section "── Step 4: Find last clean commit ──────────────────────────────────"

$damageCommit   = $null
$cleanCommit    = $null
$restorableFiles = @()

if ($TacIsSymlink) {
    Write-Info "Scenario C: symlink/junction layout — skipping commit history scan (no file restore needed)."
} else {
    Write-Info "Scanning git log to find when .tac was added to .gitignore..."

    # Strategy 1: find first commit that added ".tac" to .gitignore
    $gitignoreCommits = Invoke-Git @('log', '--format=%H', '--', '.gitignore') -AllowFailure
    if ($gitignoreCommits) {
        foreach ($sha in ($gitignoreCommits -split "`n" | Where-Object { $_ })) {
            $content = Invoke-Git @('show', "${sha}:.gitignore") -AllowFailure
            if ($content -and ($content -split "`n" | Where-Object { $_.Trim() -eq '.tac' })) {
                $damageCommit = $sha
                break
            }
        }
    }

    # Strategy 2: find commit that deleted .tac/ files
    if (-not $damageCommit -and $deletedFromHistory.Count -gt 0) {
        Write-Info "Searching for the commit that deleted .tac/ files from the index..."
        $deleteCommits = Invoke-Git @('log', '--all', '--diff-filter=D', '--format=%H', '--', '.tac/*') -AllowFailure
        if ($deleteCommits) {
            $damageCommit = ($deleteCommits -split "`n" | Where-Object { $_ } | Select-Object -First 1)
        }
    }

    if (-not $damageCommit) {
        Write-Warn "Could not pinpoint the damage commit — falling back to HEAD."
        $cleanCommit = 'HEAD'
    } else {
        $damageMsg = Invoke-Git @('log', '--format=%s', '-1', $damageCommit) -AllowFailure
        Write-Info "Damage commit: $damageCommit ($damageMsg)"
        $cleanCommit = "${damageCommit}^"
        $cleanMsg = Invoke-Git @('log', '--format=%s', '-1', $cleanCommit) -AllowFailure
        if (-not $cleanMsg) { $cleanMsg = 'unknown' }
        Write-Info "Restoring from: $cleanCommit — $cleanMsg"
    }

    # Verify restore point has .tac/ files
    $restorable = Invoke-Git @('ls-tree', '-r', '--name-only', $cleanCommit, '--', '.tac/') -AllowFailure
    $restorableFiles = if ($restorable) { $restorable -split "`n" | Where-Object { $_ } } else { @() }

    if ($restorableFiles.Count -eq 0) {
        Exit-Fatal "No .tac/ files found in restore point $cleanCommit — cannot recover. Check git log manually."
    }

    Write-Ok "Restore point has $($restorableFiles.Count) .tac/ files available."
}

# ── Step 5: Clean index (Scenario C) or restore deleted files (Scenario A/B) ─

if ($TacIsSymlink) {
    Write-Section "── Step 5: Clean stale git index entries ───────────────────────────"

    Write-Info "Running: git rm -r --cached --ignore-unmatch .tac/ ..."
    Invoke-GitOrDryRun -GitArgs @('rm', '-r', '--cached', '--ignore-unmatch', '.tac') -Display "rm -r --cached --ignore-unmatch .tac"

    if (-not $DryRun) {
        $stillStaleRaw = Invoke-Git @('ls-files', '--deleted', '--', '.tac/*') -AllowFailure
        $stillStale = if ($stillStaleRaw) { $stillStaleRaw -split "`n" | Where-Object { $_ } } else { @() }
        if ($stillStale.Count -eq 0) {
            Write-Ok "Git index cleaned — no stale .tac/ entries remain."
        } else {
            Write-Warn "$($stillStale.Count) stale entr(ies) still present — may need manual cleanup."
        }
    }
} else {
    Write-Section "── Step 5: Restore deleted .tac/ files ────────────────────────────"

    $needsRestore = ($deletedFiles.Count -gt 0) -or ($deletedFromHistory.Count -gt 0 -and $trackedInHead.Count -eq 0)

    if (-not $needsRestore) {
        Write-Ok "No deleted files to restore — skipping."
    } else {
        Write-Info "Restoring .tac/ files from $cleanCommit..."
        Invoke-GitOrDryRun -GitArgs @('checkout', $cleanCommit, '--', '.tac/') -Display "checkout $cleanCommit -- .tac/"

        if (-not $DryRun) {
            $stillMissingRaw = Invoke-Git @('ls-files', '--deleted', '--', '.tac/*') -AllowFailure
            $stillMissing = if ($stillMissingRaw) { $stillMissingRaw -split "`n" | Where-Object { $_ } } else { @() }
            if ($stillMissing.Count -eq 0) {
                Write-Ok "All .tac/ files restored successfully."
            } else {
                Write-Warn "$($stillMissing.Count) file(s) still missing after restore — may need manual recovery:"
                $stillMissing | Select-Object -First 10 | ForEach-Object { Write-Host "    - $_" }
            }
        }
    }
}

# ── Step 6: Fix .gitignore ────────────────────────────────────────────────────

Write-Section "── Step 6: Fix .gitignore ──────────────────────────────────────────"

if ($TacIsSymlink) {
    # Scenario C: .tac IS external — it should be in .gitignore.  Add if missing.
    if (-not $tacIgnoreLine) {
        Write-Info 'Adding ".tac" to .gitignore (migration complete — .tac/ is external state)...'
        if ($DryRun) {
            Write-Host "  (dry-run) Would append: .tac" -ForegroundColor Yellow
        } else {
            $appendLines = @('', '# TAC external state (symlink/junction — added by recover-tac-1364)', '.tac')
            Add-Content -LiteralPath $gitignorePath -Value $appendLines -Encoding UTF8
            Write-Ok '".tac" added to .gitignore.'
        }
    } else {
        Write-Ok '".tac" already in .gitignore — correct for external-state layout.'
    }
} else {
    # Scenario A/B: .tac is a real tracked directory — remove the bad ignore line.
    if (-not $tacIgnoreLine) {
        Write-Ok '".tac" not in .gitignore — nothing to fix.'
    } else {
        Write-Info 'Removing bare ".tac" line from .gitignore...'
        if ($DryRun) {
            Write-Host "  (dry-run) Would remove line: .tac" -ForegroundColor Yellow
        } else {
            # Filter out the exact bare ".tac" line — preserve all other content including
            # sub-path patterns like ".tac/", ".tac/activity/" and comments
            $cleaned = $gitignoreLines | Where-Object { $_.Trim() -ne '.tac' }
            # Write with UTF-8 no BOM to match git's expectations
            [System.IO.File]::WriteAllLines($gitignorePath, $cleaned, [System.Text.UTF8Encoding]::new($false))
            Write-Ok '".tac" line removed from .gitignore.'
        }
    }
}

# ── Step 7: Stage changes ─────────────────────────────────────────────────────

Write-Section "── Step 7: Stage recovery changes ──────────────────────────────────"

if (-not $DryRun) {
    $changed = Invoke-Git @('status', '--short', '--', '.tac/', '.gitignore') -AllowFailure
    if (-not $changed) {
        Write-Ok "No staged changes — working tree was already clean."
    } else {
        if ($TacIsSymlink) {
            # Scenario C: git rm --cached already staged the index cleanup.
            # Only stage .gitignore — adding .tac/ would fail (now gitignored).
            Invoke-Git @('add', '.gitignore') -AllowFailure | Out-Null
        } else {
            Invoke-Git @('add', '.tac/', '.gitignore') -AllowFailure | Out-Null
        }
        $stagedRaw  = Invoke-Git @('diff', '--cached', '--name-only', '--', '.tac/', '.gitignore') -AllowFailure
        $stagedFiles = if ($stagedRaw) { $stagedRaw -split "`n" | Where-Object { $_ } } else { @() }
        Write-Ok "$($stagedFiles.Count) file(s) staged and ready to commit."
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Section "── Summary ──────────────────────────────────────────────────────────"

if ($DryRun) {
    Write-Host "Dry-run complete. Re-run without -DryRun to apply changes." -ForegroundColor Yellow
} else {
    $finalStagedRaw  = Invoke-Git @('diff', '--cached', '--name-only', '--', '.tac/', '.gitignore') -AllowFailure
    $finalStaged = if ($finalStagedRaw) { $finalStagedRaw -split "`n" | Where-Object { $_ } } else { @() }

    if ($finalStaged.Count -gt 0) {
        Write-Host "Recovery complete. Commit with:" -ForegroundColor Green
        Write-Host ""
        if ($TacIsSymlink) {
            Write-Host '  git commit -m "fix: clean stale .tac/ index entries after external-state migration"'
        } else {
            Write-Host '  git commit -m "fix: restore .tac/ files deleted by #1364 regression"'
        }
        Write-Host ""
        Write-Host "Staged files:"
        $finalStaged | Select-Object -First 20 | ForEach-Object { Write-Host "  + $_" }
        if ($finalStaged.Count -gt 20) {
            Write-Host "  ... and $($finalStaged.Count - 20) more"
        }
    } else {
        Write-Ok "Repo is healthy — no recovery needed."
    }
}
