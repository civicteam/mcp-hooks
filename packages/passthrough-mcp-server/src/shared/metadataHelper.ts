import type {
  Notification,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Metadata that gets added to requests and results
 */
export interface PassthroughMetadata {
  targetSessionId?: string;
  sourceSessionId?: string;
  timestamp: string;
  source: string;
}

/**
 * Helper class for managing metadata operations in the passthrough context
 */
export class MetadataHelper {
  constructor(
    private readonly appendMetadataToRequest: boolean = true,
    private readonly appendMetadataToResponse: boolean = true,
    private readonly appendMetadataToNotification: boolean = true,
  ) {}

  /**
   * Add metadata to a request if enabled
   */
  addMetadataToRequest<TRequest extends Request>(
    request: TRequest,
    targetSessionId?: string,
    sourceSessionId?: string,
  ): TRequest {
    if (!this.appendMetadataToRequest) {
      return request;
    }

    return {
      ...request,
      params: {
        ...request.params,
        _meta: {
          ...request.params?._meta,
          targetSessionId,
          sourceSessionId,
          timestamp: new Date().toISOString(),
          source: "passthrough-server",
        },
      },
    };
  }

  /**
   * Add metadata to a result if enabled
   */
  addMetadataToResult<TResult extends Result>(
    result: TResult,
    targetSessionId?: string,
    sourceSessionId?: string,
  ): TResult {
    if (!this.appendMetadataToResponse) {
      return result;
    }

    return {
      ...result,
      _meta: {
        ...result._meta,
        targetSessionId,
        sourceSessionId,
        timestamp: new Date().toISOString(),
        source: "passthrough-server",
      },
    };
  }

  /**
   * Add metadata to a notification if enabled
   */
  addMetadataToNotification(
    notification: Notification,
    sessionId?: string,
  ): Notification {
    if (!this.appendMetadataToNotification) {
      return notification;
    }

    return {
      ...notification,
      params: {
        ...notification.params,
        _meta: {
          ...notification.params?._meta,
          sessionId,
          timestamp: new Date().toISOString(),
          source: "passthrough-server",
        },
      },
    };
  }
}
