// TAC-2 + scripts/lib/workspace-manifest.cjs — single source of truth for linkable @tac/* packages
'use strict'

const { readdirSync, readFileSync, existsSync, statSync } = require('fs')
const { join, resolve } = require('path')

const REPO_ROOT = resolve(__dirname, '..', '..')
const PACKAGES_DIR = join(REPO_ROOT, 'packages')

/**
 * Returns the canonical list of linkable workspace packages.
 *
 * A package is "linkable" if its `package.json` contains:
 *   { "tac": { "linkable": true, "scope": "@tac" | "@waghelapritesh", "name": "<pkgname>" } }
 *
 * Each returned entry has:
 *   - dir: directory name under packages/ (e.g. "tac-agent-core")
 *   - scope: "@tac" or "@waghelapritesh"
 *   - name: unscoped package name (e.g. "agent-core")
 *   - packageName: scoped name (e.g. "@tac/agent-core")
 *   - path: absolute path to package directory
 *   - packageJsonPath: absolute path to its package.json
 *
 * Used by:
 *   - scripts/link-workspace-packages.cjs (node_modules linkage)
 *   - src/loader.ts (via scripts/generate-ws-packages.cjs)
 *   - scripts/validate-pack.js (pack-install smoke checks)
 *   - scripts/verify-workspace-coverage.cjs (CI coverage gate)
 */
function getLinkablePackages() {
	if (!existsSync(PACKAGES_DIR)) return []
	const entries = readdirSync(PACKAGES_DIR)
	const out = []
	for (const dir of entries) {
		const pkgPath = join(PACKAGES_DIR, dir)
		if (!statSync(pkgPath).isDirectory()) continue
		const pkgJsonPath = join(pkgPath, 'package.json')
		if (!existsSync(pkgJsonPath)) continue
		let pkg
		try {
			pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
		} catch (err) {
			throw new Error(`Invalid package.json at ${pkgJsonPath}: ${err.message}`)
		}
		const tac = pkg.tac
		if (!tac || tac.linkable !== true) continue
		if (!tac.scope || !tac.name) {
			throw new Error(
				`${pkgJsonPath}: "tac.linkable" is true but "tac.scope" or "tac.name" is missing.`
			)
		}
		if (tac.scope !== '@tac' && tac.scope !== '@waghelapritesh') {
			throw new Error(
				`${pkgJsonPath}: "tac.scope" must be "@tac" or "@waghelapritesh" (got "${tac.scope}").`
			)
		}
		const expectedName = `${tac.scope}/${tac.name}`
		if (pkg.name !== expectedName) {
			throw new Error(
				`${pkgJsonPath}: package.json "name" (${pkg.name}) does not match tac.scope/tac.name (${expectedName}).`
			)
		}
		out.push({
			dir,
			scope: tac.scope,
			name: tac.name,
			packageName: pkg.name,
			path: pkgPath,
			packageJsonPath: pkgJsonPath,
		})
	}
	out.sort((a, b) => a.packageName.localeCompare(b.packageName))
	return out
}

/** Returns only packages in the `@tac` scope (excludes `@waghelapritesh`). */
function getCorePackages() {
	return getLinkablePackages().filter((p) => p.scope === '@tac')
}

module.exports = {
	REPO_ROOT,
	PACKAGES_DIR,
	getLinkablePackages,
	getCorePackages,
}
