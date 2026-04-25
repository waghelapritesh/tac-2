import test from "node:test";
import assert from "node:assert/strict";

const { filterInitialTacHeader } = await import("../../web/lib/initial-tac-header-filter.ts");

const TAC_LOGO_LINES = [
  "   ██████╗ ███████╗██████╗ ",
  "  ██╔════╝ ██╔════╝██╔══██╗",
  "  ██║  ███╗███████╗██║  ██║",
  "  ██║   ██║╚════██║██║  ██║",
  "  ╚██████╔╝███████║██████╔╝",
  "   ╚═════╝ ╚══════╝╚═════╝ ",
] as const;

test("filterInitialTacHeader strips a plain startup banner and keeps real terminal content", () => {
  const warning = "Warning: Google Search is not configured.";
  const raw = [...TAC_LOGO_LINES, "  Think. Architect. Code. v2.33.1", "", warning].join("\n");

  const result = filterInitialTacHeader(raw);

  assert.equal(result.status, "matched");
  assert.equal(result.text, warning);
});

test("filterInitialTacHeader strips ANSI-colored startup banner output", () => {
  const cyan = "\u001b[36m";
  const reset = "\u001b[39m";
  const bold = "\u001b[1m";
  const boldReset = "\u001b[22m";
  const dim = "\u001b[2m";
  const dimReset = "\u001b[22m";
  const warning = "Warning: terminal content starts here.\r\n";

  const raw =
    TAC_LOGO_LINES.map((line) => `${cyan}${line}${reset}\r\n`).join("") +
    `  ${bold}Think. Architect. Code.${boldReset} ${dim}v2.33.1${dimReset}\r\n\r\n` +
    warning;

  const result = filterInitialTacHeader(raw);

  assert.equal(result.status, "matched");
  assert.equal(result.text, warning);
});

test("filterInitialTacHeader waits for more data when the startup banner is incomplete", () => {
  const partial = `${TAC_LOGO_LINES[0]}\n${TAC_LOGO_LINES[1]}\n${TAC_LOGO_LINES[2]}`;

  const result = filterInitialTacHeader(partial);

  assert.deepEqual(result, { status: "needs-more", text: "" });
});

test("filterInitialTacHeader passes normal terminal output through untouched", () => {
  const raw = "Warning: already in the shell\r\n$ ";

  const result = filterInitialTacHeader(raw);

  assert.equal(result.status, "passthrough");
  assert.equal(result.text, raw);
});
