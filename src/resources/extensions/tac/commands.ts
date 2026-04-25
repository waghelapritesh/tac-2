export { registerTACCommand } from "./commands/index.js";

export async function handleTACCommand(
  ...args: Parameters<typeof import("./commands/dispatcher.js").handleTACCommand>
) {
  const { handleTACCommand: dispatch } = await import("./commands/dispatcher.js");
  return dispatch(...args);
}

export async function fireStatusViaCommand(
  ...args: Parameters<typeof import("./commands/handlers/core.js").fireStatusViaCommand>
) {
  const { fireStatusViaCommand: fireStatus } = await import(
    "./commands/handlers/core.js"
  );
  return fireStatus(...args);
}
