#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * Uses main.ts with AgentSession and new mode modules.
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 */
process.title = "pi";

import { setBedrockProviderModule } from "@tac/pi-ai";
import { bedrockProviderModule } from "@tac/pi-ai/bedrock-provider";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { main } from "./main.js";

setGlobalDispatcher(new EnvHttpProxyAgent());
setBedrockProviderModule(bedrockProviderModule);

main(process.argv.slice(2));
