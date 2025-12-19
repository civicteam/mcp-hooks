/**
 * Rate Limit Hook
 *
 * Enforces rate limits on tool calls per user
 */

import {
  AbstractHook,
  type CallToolRequest,
  type CallToolRequestHookResult,
} from "@civic/hook-common";

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export class RateLimitHook extends AbstractHook {
  name = "rate-limit-hook";

  private rateLimits = new Map<string, RateLimitInfo>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private limitPerMinute = 10,
    _limitPerHour = 100,
    private cleanupIntervalMs = 300000, // 5 minutes
  ) {
    super();
    this.startCleanupTimer();
  }

  async processCallToolRequest(
    request: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    // Extract userId from metadata
    const userId = this.extractUserId(request);
    if (!userId) {
      // No user ID, allow the request
      return { resultType: "continue", request };
    }

    const now = Date.now();
    const userLimits = this.rateLimits.get(userId) || {
      count: 0,
      resetTime: now + 60000, // 1 minute from now
    };

    // Reset counter if time window has passed
    if (now > userLimits.resetTime) {
      userLimits.count = 0;
      userLimits.resetTime = now + 60000;
    }

    // Check rate limit
    if (userLimits.count >= this.limitPerMinute) {
      const retryAfter = Math.ceil((userLimits.resetTime - now) / 1000); // seconds
      throw new Error(
        `Rate limit exceeded. Too many requests. Retry after ${retryAfter} seconds. Limit: ${this.limitPerMinute} per minute`,
      );
    }

    // Increment counter and allow request
    userLimits.count++;
    this.rateLimits.set(userId, userLimits);

    return { resultType: "continue", request };
  }

  private extractUserId(request: CallToolRequest): string | undefined {
    // Try to extract userId from metadata
    const meta = request.params._meta;
    if (meta) {
      // Support different metadata structures
      if (typeof meta === "object" && "userId" in meta) {
        return String(meta.userId);
      }
      if (typeof meta === "object" && "sessionId" in meta) {
        // Fallback to sessionId if no userId
        return String(meta.sessionId);
      }
    }
    return undefined;
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEntries();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop the cleanup timer
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up old entries periodically to prevent memory growth
   */
  cleanupOldEntries(): void {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hour ago

    for (const [userId, limits] of this.rateLimits.entries()) {
      if (limits.resetTime < cutoff) {
        this.rateLimits.delete(userId);
      }
    }
  }
}
