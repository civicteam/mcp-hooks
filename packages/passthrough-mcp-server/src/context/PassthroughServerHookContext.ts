/**
 * PassthroughServer-specific hook context
 */

import type { HookContext } from "@civic/hook-common";
import type { PassthroughClient } from "../types/client.js";

/**
 * Data structure for PassthroughServer context
 */
export interface PassthroughServerContextData {
  sessionId: string;
  targetClient: PassthroughClient;
  recreateTargetClient: () => Promise<PassthroughClient>;
}

/**
 * PassthroughServer-specific hook context with typed access to passthrough functionality
 */
export class PassthroughServerHookContext
  implements HookContext<PassthroughServerContextData, "passthrough-server">
{
  readonly contextType = "passthrough-server" as const;

  constructor(public readonly data: PassthroughServerContextData) {}

  /**
   * Get the session ID
   */
  get sessionId(): string {
    return this.data.sessionId;
  }

  /**
   * Get the target client for making requests
   */
  getTargetClient(): PassthroughClient {
    return this.data.targetClient;
  }

  /**
   * Recreate the target client (useful for error recovery)
   */
  async recreateClient(): Promise<PassthroughClient> {
    return await this.data.recreateTargetClient();
  }
}

/**
 * Type guard to check if context is a PassthroughServer context
 */
export function isPassthroughServerContext(
  context: HookContext | undefined,
): context is PassthroughServerHookContext {
  return context?.contextType === "passthrough-server";
}

/**
 * Helper to safely get PassthroughServer context data
 */
export function getPassthroughServerContext(
  context: HookContext | undefined,
): PassthroughServerHookContext | undefined {
  return isPassthroughServerContext(context) ? context : undefined;
}
