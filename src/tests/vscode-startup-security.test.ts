import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const extensionSource = readFileSync(join(process.cwd(), "vscode-extension", "src", "extension.ts"), "utf-8");

test("VS Code startup uses inspected global/default config for binary path and auto-start", () => {
  assert.match(extensionSource, /inspect<T>\(key\)/);
  assert.match(extensionSource, /globalValue \?\? inspected\?\.defaultValue/);
  assert.match(extensionSource, /binaryPath:\s*getTrustedConfigurationValue\("tac",\s*"binaryPath",\s*"tac"\)/);
  assert.match(extensionSource, /autoStart:\s*getTrustedConfigurationValue\("tac",\s*"autoStart",\s*false\)/);
  assert.doesNotMatch(extensionSource, /config\.get<string>\("binaryPath"/);
  assert.doesNotMatch(extensionSource, /config\.get<boolean>\("autoStart"/);
});
