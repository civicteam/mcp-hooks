/**
 * HTTP Utilities Module
 *
 * Provides shared HTTP functionality used by both message handlers
 */

import * as http from "node:http";
import * as https from "node:https";
import type { URL } from "node:url";

/**
 * Extract response headers excluding connection-specific ones
 */
export function extractResponseHeaders(
  headers: http.IncomingHttpHeaders,
): Record<string, string> {
  const excludeHeaders = [
    "connection",
    "transfer-encoding",
    "content-encoding",
    "content-length",
  ];

  return Object.entries(headers).reduce(
    (acc, [key, value]) => {
      if (
        !excludeHeaders.includes(key.toLowerCase()) &&
        typeof value === "string"
      ) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Make HTTP request with appropriate module based on protocol
 */
export function makeHttpRequest(
  options: http.RequestOptions,
  targetUrlObj: URL,
): http.ClientRequest {
  const httpModule = targetUrlObj.protocol === "https:" ? https : http;
  return httpModule.request(options);
}
