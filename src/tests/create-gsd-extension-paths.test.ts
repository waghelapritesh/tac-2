/**
 * Validates that the create-tac-extension skill documentation uses the correct
 * community extension install path (~/.pi/agent/extensions/) instead of the
 * bundled-only path (~/.tac/agent/extensions/).
 *
 * Bug: https://github.com/waghelapritesh/tac-2/issues/3131
 *
 * ~/.tac/agent/extensions/ is reserved for bundled extensions synced from
 * the tac-2 package. Community/user extensions must use ~/.pi/agent/extensions/.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = join(__dirname, "..", "resources", "skills", "create-tac-extension");

function readSkillFile(relativePath: string): string {
  return readFileSync(join(skillDir, relativePath), "utf-8");
}

// All documentation files that reference community extension paths
const docsToCheck: { file: string; label: string }[] = [
  { file: "SKILL.md", label: "SKILL.md" },
  { file: "references/key-rules-gotchas.md", label: "key-rules-gotchas.md" },
  { file: "workflows/add-capability.md", label: "add-capability.md" },
  { file: "workflows/create-extension.md", label: "create-extension.md" },
  { file: "workflows/debug-extension.md", label: "debug-extension.md" },
];

test("create-tac-extension docs use ~/.pi/agent/extensions/ for community extensions", async (t) => {
  for (const { file, label } of docsToCheck) {
    await t.test(`${label} references ~/.pi/agent/extensions/ for global extensions`, () => {
      const content = readSkillFile(file);

      // The doc should reference ~/.pi/agent/extensions/ (community path)
      assert.ok(
        content.includes("~/.pi/agent/extensions/"),
        `${label} should reference ~/.pi/agent/extensions/ for community extensions`,
      );
    });
  }
});

test("create-tac-extension docs do NOT direct users to install in ~/.tac/agent/extensions/", async (t) => {
  for (const { file, label } of docsToCheck) {
    await t.test(`${label} does not tell users to place extensions in ~/.tac/agent/extensions/`, () => {
      const content = readSkillFile(file);

      // ~/.tac/agent/extensions/ should only appear in context that clearly marks
      // it as reserved/bundled, never as an install target for community extensions.
      // We check that it does NOT appear as a "Global extensions:" or "Global:" path directive.
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("~/.tac/agent/extensions/")) {
          // If the line references ~/.tac/agent/extensions/, it must be in a
          // context explaining it is reserved/bundled — not as an install instruction.
          const context = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
          const isBundledContext =
            context.toLowerCase().includes("bundled") ||
            context.toLowerCase().includes("reserved") ||
            context.toLowerCase().includes("synced");
          assert.ok(
            isBundledContext,
            `${label} line ${i + 1} references ~/.tac/agent/extensions/ without ` +
            `marking it as bundled/reserved. Context:\n${context}`,
          );
        }
      }
    });
  }
});
