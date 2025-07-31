export class PassthroughSessionContext {
  /**
   * Session ID for this passthrough session
   * Normally Server and ClientTransport define their own sessionID, in the PassthroughContext this is shared.
   */
  private _sessionId?: string;
  private _sessionIdPromise?: Promise<string>;
  private _sessionIdResolve?: (sessionId: string) => void;

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  set sessionId(sessionId: string | undefined) {
    if (sessionId !== undefined && this._sessionId === undefined) {
      // Transitioning from undefined to string
      this._sessionId = sessionId;
      this._sessionIdResolve?.(sessionId);
    } else {
      this._sessionId = sessionId;
    }
  }

  /**
   * Returns a promise that resolves when the sessionId transitions from undefined to a string value.
   * If sessionId is already set, resolves immediately with the current value.
   */
  async ensureSessionId(): Promise<string> {
    if (this._sessionId !== undefined) {
      return this._sessionId;
    }

    if (!this._sessionIdPromise) {
      this._sessionIdPromise = new Promise<string>((resolve) => {
        this._sessionIdResolve = resolve;
      });
    }

    return this._sessionIdPromise;
  }
}
