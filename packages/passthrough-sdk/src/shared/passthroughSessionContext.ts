export class PassthroughSessionContext {
  /**
   * Session ID for this passthrough session
   * Normally Server and ClientTransport define their own sessionID, in the PassthroughContext this is shared.
   */
  sessionId?: string;
}
