/**
 * HTTP Header Utilities
 */

import type * as http from "node:http";

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
