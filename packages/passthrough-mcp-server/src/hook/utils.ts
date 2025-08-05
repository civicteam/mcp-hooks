/**
 * Hook Utility Functions
 *
 * Provides convenience functions for creating and managing hooks
 */

import type { Hook } from "@civic/hook-common";
import { LocalHookClient, RemoteHookClient } from "@civic/hook-common";
import { logger } from "../logger/logger.js";
import type { HookDefinition } from "../proxy/config.js";

/**
 * Check if a hook definition is a Hook instance
 */
function isHookInstance(hook: HookDefinition): hook is Hook {
  return "processToolCallRequest" in hook && "processToolCallResponse" in hook;
}

/**
 * Create a Hook from a HookDefinition
 *
 * @param definition - Hook definition (Hook instance or RemoteHookConfig)
 * @returns A Hook instance
 */
export function createHookClient(definition: HookDefinition): Hook {
  if (isHookInstance(definition)) {
    logger.debug(`Creating LocalHookClient for hook: ${definition.name}`);
    return new LocalHookClient(definition);
  }

  // It's a RemoteHookConfig
  logger.debug(`Creating RemoteHookClient for URL: ${definition.url}`);
  return new RemoteHookClient({
    url: definition.url,
    name: definition.name || definition.url,
  });
}

/**
 * Create multiple Hooks from an array of definitions
 *
 * @param definitions - Array of hook definitions
 * @returns Array of Hook instances
 */
export function createHookClients(definitions: HookDefinition[]): Hook[] {
  return definitions.map(createHookClient);
}
