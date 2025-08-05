/**
 * HTTP utility functions
 */

import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

/**
 * Parse JSON body from an HTTP request
 * @param req - The incoming HTTP request
 * @returns The parsed JSON body or undefined if empty
 * @throws Error if the body cannot be parsed as JSON
 */
// biome-ignore lint/suspicious/noExplicitAny: JSON parsing returns unknown structure
export async function parseJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString();
  return rawBody ? JSON.parse(rawBody) : undefined;
}

/**
 * Standard HTTP hop-by-hop headers that should not be forwarded by proxies
 * Based on RFC 7230 Section 6.1
 */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

/**
 * Headers that should not be forwarded from incoming requests to the MCP client
 * Includes:
 * - Standard hop-by-hop headers (RFC 7230)
 * - MCP-specific headers
 * - Headers that will be set by the transport itself
 * - Security-sensitive headers
 */
const FILTERED_HEADERS = new Set([
  // Standard hop-by-hop headers
  ...HOP_BY_HOP_HEADERS,

  // Request-specific headers that will be set by the transport
  "host", // Target host is different
  "content-length", // Will be recalculated
  "content-type", // Set by the transport for the request
  "accept", // Set by the transport based on request type
  "accept-encoding", // Let the HTTP client handle encoding

  // MCP-specific headers
  "authorization", // Handled specially with config priority
  "mcp-session-id", // Session management
  "mcp-protocol-version", // Protocol version
  "last-event-id", // SSE resumption

  // Security headers that might leak information
  "cookie", // Don't forward cookies
  "set-cookie", // Don't forward cookies
]);

/**
 * Build headers for MCP client transport, forwarding all non-reserved headers
 * @param incomingHeaders - Headers from the incoming request
 * @param authToken - Optional auth token from config (takes priority)
 * @returns Headers object for the client transport
 */
export function buildClientHeaders(
  incomingHeaders: IncomingHttpHeaders,
  authToken?: string,
): Record<string, string> | undefined {
  const headers: Record<string, string> = {};

  // Forward all non-filtered headers from the incoming request
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (!FILTERED_HEADERS.has(key.toLowerCase()) && value) {
      // Handle array values (rare but possible)
      headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  // Set Authorization header - config takes priority
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  } else if (incomingHeaders.authorization) {
    headers.Authorization = Array.isArray(incomingHeaders.authorization)
      ? incomingHeaders.authorization.join(", ")
      : incomingHeaders.authorization;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}
