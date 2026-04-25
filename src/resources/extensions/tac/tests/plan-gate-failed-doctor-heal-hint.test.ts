/**
 * Regression test for #4620.
 *
 * Ensures plan gate failed-closed errors include a self-heal hint
 * directing users to /tac doctor heal.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tacDir = join(__dirname, "..");

function readSrc(file: string): string {
  return readFileSync(join(tacDir, file), "utf-8");
}

test("#4620: auto/phases plan gate failed message includes doctor heal hint", () => {
  const src = readSrc("auto/phases.ts");
  assert.match(
    src,
    /Plan gate failed-closed:[\s\S]*\/tac doctor heal/,
    "auto/phases.ts should include /tac doctor heal in plan gate failed notification",
  );
});

test("#4620: guided-flow plan gate failed message includes doctor heal hint", () => {
  const src = readSrc("guided-flow.ts");
  assert.match(
    src,
    /Plan gate failed-closed:[\s\S]*\/tac doctor heal/,
    "guided-flow.ts should include /tac doctor heal in plan gate failed notification",
  );
});
