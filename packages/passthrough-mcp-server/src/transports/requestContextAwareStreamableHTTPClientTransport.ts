import type { RequestContext } from "@civic/hook-common";
import {
  auth,
  extractResourceMetadataUrl,
  UnauthorizedError,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
  type StreamableHTTPReconnectionOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  isInitializedNotification,
  isJSONRPCRequest,
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Default reconnection options for StreamableHTTP connections
const _DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS: StreamableHTTPReconnectionOptions =
  {
    initialReconnectionDelay: 1000,
    maxReconnectionDelay: 30000,
    reconnectionDelayGrowFactor: 1.5,
    maxRetries: 2,
  };

/**
 * NOTE: Extension of StreamableHTTPClientTransport with an updated send() to take an optional requestContext.
 *
 *
 * Client transport for Streamable HTTP: this implements the MCP Streamable HTTP transport specification.
 * It will connect to a server using HTTP POST for sending messages and HTTP GET with Server-Sent Events
 * for receiving messages.
 */
export class RequestContextAwareStreamableHTTPClientTransport extends StreamableHTTPClientTransport {
  override async send(
    message: JSONRPCMessage | JSONRPCMessage[],
    options?: {
      resumptionToken?: string;
      onresumptiontoken?: (token: string) => void;
      requestContext?: RequestContext;
    },
  ): Promise<void> {
    try {
      const { resumptionToken, onresumptiontoken } = options || {};

      if (resumptionToken) {
        // If we have at last event ID, we need to reconnect the SSE stream
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent method
        (this as any)
          ._startOrAuthSse({
            resumptionToken,
            replayMessageId: isJSONRPCRequest(message) ? message.id : undefined,
          })
          // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
          .catch((err: any) => this.onerror?.(err));
        return;
      }

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent method
      const headers = await (this as any)._commonHeaders();
      headers.set("content-type", "application/json");
      headers.set("accept", "application/json, text/event-stream");

      let finalHeaders = headers;
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
      let finalUrl = (this as any)._url;
      if (options?.requestContext) {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
        const updatedUrl = new URL((this as any)._url);

        if (options.requestContext.host) {
          updatedUrl.hostname = options.requestContext.host;
        }

        if (options.requestContext.path) {
          updatedUrl.pathname = options.requestContext.path;
          updatedUrl.search = ""; // Clear search params if path is overridden
        }

        // Keep the protocol from the original URL
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
        updatedUrl.protocol = (this as any)._url.protocol;

        finalUrl = updatedUrl;

        if (options.requestContext.headers) {
          finalHeaders = new Headers({
            ...Object.fromEntries(headers.entries()),
            ...options.requestContext.headers,
          });
        }
      }

      const init = {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
        ...(this as any)._requestInit,
        method: "POST",
        headers: finalHeaders,
        body: JSON.stringify(message),
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
        signal: (this as any)._abortController?.signal,
      };

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
      const response = await ((this as any)._fetch ?? fetch)(finalUrl, init);

      // Handle session ID received during initialization
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
        (this as any)._sessionId = sessionId;
      }

      if (!response.ok) {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
        if (response.status === 401 && (this as any)._authProvider) {
          // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
          (this as any)._resourceMetadataUrl =
            extractResourceMetadataUrl(response);

          // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
          const result = await auth((this as any)._authProvider, {
            // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
            serverUrl: (this as any)._url,
            // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
            resourceMetadataUrl: (this as any)._resourceMetadataUrl,
            // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent property
            fetchFn: (this as any)._fetch,
          });
          if (result !== "AUTHORIZED") {
            throw new UnauthorizedError();
          }

          // Purposely _not_ awaited, so we don't call onerror twice
          return this.send(message);
        }

        const text = await response.text().catch(() => null);
        throw new Error(
          `Error POSTing to endpoint (HTTP ${response.status}): ${text}`,
        );
      }

      // If the response is 202 Accepted, there's no body to process
      if (response.status === 202) {
        // if the accepted notification is initialized, we start the SSE stream
        // if it's supported by the server
        if (isInitializedNotification(message)) {
          // Start without a lastEventId since this is a fresh connection
          // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent method
          (this as any)
            ._startOrAuthSse({ resumptionToken: undefined })
            // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
            .catch((err: any) => this.onerror?.(err));
        }
        return;
      }

      // Get original message(s) for detecting request IDs
      const messages = Array.isArray(message) ? message : [message];

      const hasRequests =
        messages.filter(
          (msg) => "method" in msg && "id" in msg && msg.id !== undefined,
        ).length > 0;

      // Check the response type
      const contentType = response.headers.get("content-type");

      if (hasRequests) {
        if (contentType?.includes("text/event-stream")) {
          // Handle SSE stream responses for requests
          // We use the same handler as standalone streams, which now supports
          // reconnection with the last event ID
          // biome-ignore lint/suspicious/noExplicitAny: Accessing private parent method
          (this as any)._handleSseStream(
            response.body,
            { onresumptiontoken },
            false,
          );
        } else if (contentType?.includes("application/json")) {
          // For non-streaming servers, we might get direct JSON responses
          const data = await response.json();
          const responseMessages = Array.isArray(data)
            ? data.map((msg) => JSONRPCMessageSchema.parse(msg))
            : [JSONRPCMessageSchema.parse(data)];

          for (const msg of responseMessages) {
            this.onmessage?.(msg);
          }
        } else {
          throw new StreamableHTTPError(
            -1,
            `Unexpected content type: ${contentType}`,
          );
        }
      }
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }
}
