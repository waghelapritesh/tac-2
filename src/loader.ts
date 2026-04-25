#!/usr/bin/env node
// TAC Startup Loader
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
import { fileURLToPath } from 'url'
import { dirname, resolve, join, relative, delimiter } from 'path'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, symlinkSync, cpSync } from 'fs'

// Fast-path: handle --version/-v and --help/-h before importing any heavy
// dependencies. This avoids loading the entire pi-coding-agent barrel import
// (~1s) just to print a version string.
const tacRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const firstArg = args[0]

// Read package.json once — reused for version, banner, and TAC_VERSION below
let tacVersion = '0.0.0'
try {
  const pkg = JSON.parse(readFileSync(join(tacRoot, 'package.json'), 'utf-8'))
  tacVersion = pkg.version || '0.0.0'
} catch { /* ignore */ }

if (firstArg === '--version' || firstArg === '-v') {
  process.stdout.write(tacVersion + '\n')
  process.exit(0)
}

if (firstArg === '--help' || firstArg === '-h') {
  const { printHelp } = await import('./help-text.js')
  printHelp(tacVersion)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Runtime dependency checks — fail fast with clear diagnostics before any
// heavy imports. Reads minimum Node version from the engines field in
// package.json (already parsed above) and verifies git is available.
// ---------------------------------------------------------------------------
{
  const MIN_NODE_MAJOR = 22
  const red = '\x1b[31m'
  const bold = '\x1b[1m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'

  // -- Node version --
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10)
  if (nodeMajor < MIN_NODE_MAJOR) {
    process.stderr.write(
      `\n${red}${bold}Error:${reset} TAC requires Node.js >= ${MIN_NODE_MAJOR}.0.0\n` +
      `       You are running Node.js ${process.versions.node}\n\n` +
      `${dim}Install a supported version:${reset}\n` +
      `  nvm install ${MIN_NODE_MAJOR}   ${dim}# if using nvm${reset}\n` +
      `  fnm install ${MIN_NODE_MAJOR}   ${dim}# if using fnm${reset}\n` +
      `  brew install node@${MIN_NODE_MAJOR} ${dim}# macOS Homebrew${reset}\n\n`
    )
    process.exit(1)
  }

  // -- git --
  try {
    const { execFileSync } = await import('child_process')
    execFileSync('git', ['--version'], { stdio: 'ignore' })
  } catch {
    process.stderr.write(
      `\n${red}${bold}Error:${reset} TAC requires git but it was not found on PATH.\n\n` +
      `${dim}Install git:${reset}\n` +
      `  https://git-scm.com/downloads\n\n`
    )
    process.exit(1)
  }
}

import { agentDir, appRoot } from './app-paths.js'
import { applyRtkProcessEnv } from './rtk.js'
import { serializeBundledExtensionPaths } from './bundled-extension-paths.js'
import { discoverExtensionEntryPaths } from './extension-discovery.js'
import { loadRegistry, readManifestFromEntryPath, isExtensionEnabled } from './extension-registry.js'
import { renderLogo } from './logo.js'

// pkg/ is a shim directory: contains tac's piConfig (package.json) and pi's
// theme assets (dist/modes/interactive/theme/) without a src/ directory.
// This allows config.js to:
//   1. Read piConfig.name → "tac" (branding)
//   2. Resolve themes via dist/ (no src/ present → uses dist path)
const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'pkg')

// MUST be set before any dynamic import of pi SDK fires — this is what config.js
// reads to determine APP_NAME and CONFIG_DIR_NAME
process.env.PI_PACKAGE_DIR = pkgDir
process.env.PI_SKIP_VERSION_CHECK = '1'  // TAC runs its own update check in cli.ts — suppress pi's
process.title = 'tac'

// Print branded banner on first launch (before ~/.tac/ exists).
// Set TAC_FIRST_RUN_BANNER so cli.ts skips the duplicate welcome screen.
if (!existsSync(appRoot)) {
  const cyan  = '\x1b[36m'
  const green = '\x1b[32m'
  const dim   = '\x1b[2m'
  const reset = '\x1b[0m'
  const colorCyan = (s: string) => `${cyan}${s}${reset}`
  process.stderr.write(
    renderLogo(colorCyan) +
    '\n' +
    `  Think. Architect. Code. ${dim}v${tacVersion}${reset}\n` +
    `  ${green}Welcome.${reset} Setting up your environment...\n\n`
  )
  process.env.TAC_FIRST_RUN_BANNER = '1'
}

// TAC_CODING_AGENT_DIR — tells pi's getAgentDir() to return ~/.tac/agent/ instead of ~/.tac/agent/
process.env.TAC_CODING_AGENT_DIR = agentDir

// TAC_PKG_ROOT — absolute path to tac-2 package root. Used by deployed extensions
// (e.g. auto.ts resume path) to import modules like resource-loader.js that live
// in the package tree, not in the deployed ~/.tac/agent/ tree.
process.env.TAC_PKG_ROOT = tacRoot

// RTK environment — make ~/.tac/agent/bin visible to all child-process paths,
// not just the bash tool, and force-disable RTK telemetry for TAC-managed use.
applyRtkProcessEnv(process.env)

// NODE_PATH — make tac's own node_modules available to extensions loaded via jiti.
// Without this, extensions (e.g. browser-tools) can't resolve dependencies like
// `playwright` because jiti resolves modules from pi-coding-agent's location, not tac's.
// Prepending tac's node_modules to NODE_PATH fixes this for all extensions.
const tacNodeModules = join(tacRoot, 'node_modules')
process.env.NODE_PATH = [tacNodeModules, process.env.NODE_PATH]
  .filter(Boolean)
  .join(delimiter)
// Force Node to re-evaluate module search paths with the updated NODE_PATH.
// Must happen synchronously before cli.js imports → extension loading.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Module } = await import('module');
(Module as any)._initPaths?.()

// TAC_VERSION — expose package version so extensions can display it
process.env.TAC_VERSION = tacVersion

// TAC_BIN_PATH — absolute path to this loader (dist/loader.js), used by patched subagent
// to spawn tac instead of pi when dispatching workflow tasks
process.env.TAC_BIN_PATH = process.argv[1]

// TAC_WORKFLOW_PATH — absolute path to bundled TAC-WORKFLOW.md, used by patched tac extension
// when dispatching workflow prompts. Prefers dist/resources/ (stable, set at build time)
// over src/resources/ (live working tree) — see resource-loader.ts for rationale.
const distRes = join(tacRoot, 'dist', 'resources')
const srcRes = join(tacRoot, 'src', 'resources')
const resourcesDir = existsSync(distRes) ? distRes : srcRes
process.env.TAC_WORKFLOW_PATH = join(resourcesDir, 'TAC-WORKFLOW.md')

// TAC_BUNDLED_EXTENSION_PATHS — dynamically discovered bundled extension entry points.
// Uses the shared discoverExtensionEntryPaths() to scan the bundled resources
// directory, then remaps discovered paths to agentDir (~/.tac/agent/extensions/)
// where initResources() will sync them.
const bundledExtDir = join(resourcesDir, 'extensions')
const agentExtDir = join(agentDir, 'extensions')
const registry = loadRegistry()
const discoveredExtensionPaths = discoverExtensionEntryPaths(bundledExtDir)
  .map((entryPath) => join(agentExtDir, relative(bundledExtDir, entryPath)))
  .filter((entryPath) => {
    const manifest = readManifestFromEntryPath(entryPath)
    if (!manifest) return true  // no manifest = always load
    return isExtensionEnabled(registry, manifest.id)
  })

process.env.TAC_BUNDLED_EXTENSION_PATHS = serializeBundledExtensionPaths(discoveredExtensionPaths)

// Respect HTTP_PROXY / HTTPS_PROXY / NO_PROXY env vars for all outbound requests.
// pi-coding-agent's cli.ts sets this, but TAC bypasses that entry point — so we
// must set it here before any SDK clients are created.
// Lazy-load undici (~200ms) only when proxy env vars are actually set.
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy) {
  const { EnvHttpProxyAgent, setGlobalDispatcher } = await import('undici')
  setGlobalDispatcher(new EnvHttpProxyAgent())
}

// Ensure workspace packages are linked (or copied on Windows) before importing
// cli.js (which imports @tac/*).
// npm postinstall handles this normally, but npx --ignore-scripts skips postinstall.
// On Windows without Developer Mode or admin rights, symlinkSync will throw even for
// 'junction' type — so we fall back to cpSync (a full directory copy) which works
// everywhere without elevated permissions.
// Discover linkable workspace packages by scanning packages/*/package.json for
// `tac.linkable === true`. This is the single source of truth — the same list
// read by scripts/link-workspace-packages.cjs and scripts/validate-pack.js.
// Adding a new linkable package requires only setting `tac.linkable` in its
// package.json; there is no enumeration to keep in sync here.
const packagesDir = join(tacRoot, 'packages')
type WsPkg = { dir: string; scope: string; name: string }
const wsPackages: WsPkg[] = []
try {
  if (existsSync(packagesDir)) {
    for (const dir of readdirSync(packagesDir)) {
      const pkgPath = join(packagesDir, dir)
      if (!statSync(pkgPath).isDirectory()) continue
      const pkgJsonPath = join(pkgPath, 'package.json')
      if (!existsSync(pkgJsonPath)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
        const tac = pkg.tac
        if (!tac || tac.linkable !== true) continue
        if (tac.scope && tac.name) wsPackages.push({ dir, scope: tac.scope, name: tac.name })
      } catch { /* ignore malformed package.json */ }
    }
  }
} catch { /* non-fatal — validation below catches missing critical packages */ }

try {
  for (const pkg of wsPackages) {
    const scopeDir = join(tacNodeModules, pkg.scope)
    if (!existsSync(scopeDir)) mkdirSync(scopeDir, { recursive: true })
    const target = join(scopeDir, pkg.name)
    const source = join(packagesDir, pkg.dir)
    if (!existsSync(source) || existsSync(target)) continue
    try {
      symlinkSync(source, target, 'junction')
    } catch {
      // Symlink failed (common on Windows without Developer Mode / admin).
      // Fall back to a directory copy — slower on first run but universally works.
      try { cpSync(source, target, { recursive: true }) } catch { /* non-fatal */ }
    }
  }
} catch { /* non-fatal */ }

const tacScopeDir = join(tacNodeModules, '@tac')

// Validate critical workspace packages are resolvable. If still missing after the
// symlink+copy attempts, emit a clear diagnostic instead of a cryptic
// ERR_MODULE_NOT_FOUND from deep inside cli.js.
const criticalPackages = ['pi-coding-agent']
const missingPackages = criticalPackages.filter(pkg => !existsSync(join(tacScopeDir, pkg)))
if (missingPackages.length > 0) {
  const missing = missingPackages.map(p => `@tac/${p}`).join(', ')
  process.stderr.write(
    `\nError: TAC installation is broken — missing packages: ${missing}\n\n` +
    `This is usually caused by one of:\n` +
    `  • An outdated version installed from npm (run: npm install -g tac-2@latest)\n` +
    `  • The packages/ directory was excluded from the installed tarball\n` +
    `  • A filesystem error prevented linking or copying the workspace packages\n\n` +
    `Fix it by reinstalling:\n\n` +
    `  npm install -g tac-2@latest\n\n` +
    `If the issue persists, please open an issue at:\n` +
    `  https://github.com/waghelapritesh/tac-2/issues\n`
  )
  process.exit(1)
}

// Dynamic import defers ESM evaluation — config.js will see PI_PACKAGE_DIR above
await import('./cli.js')
