/**
 * MCP Session Manager
 *
 * Manages MCP sessions for the HTTP Passthrough Proxy
 */

import type { PassthroughContext } from "../../shared/passthroughContext.js";

export interface McpSession {
  id: string;
  createdAt: Date;
  context: PassthroughContext;
}

export class McpSessionManager {
  private sessions = new Map<string, McpSession>();

  /**
   * Add a new session
   */
  addSession(
    sessionId: string,
    context: PassthroughContext,
    _metadata?: Record<string, unknown>,
  ): McpSession {
    const session: McpSession = {
      id: sessionId,
      createdAt: new Date(),
      context,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Remove a specific session
   */
  async removeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    await session?.context.close();

    return this.sessions.delete(sessionId);
  }

  /**
   * Remove all sessions
   */
  async removeAllSessions(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.context.close();
    }
    this.sessions.clear();
  }

  /**
   * Get a specific session
   */
  getSession(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): McpSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
