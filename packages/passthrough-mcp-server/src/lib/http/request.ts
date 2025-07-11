/**
 * HTTP Request Utilities
 */

import * as http from "node:http";
import * as https from "node:https";
import type { URL } from "node:url";
import { logger } from "../logger.js";

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

/**
 * Build HTTP request options
 */
export function buildRequestOptions(
  url: URL,
  requestBody: string,
  headers: Record<string, string>,
): http.RequestOptions {
  return {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
      "Content-Length": Buffer.byteLength(requestBody),
    },
  };
}

/**
 * Make HTTP request and return response
 */
export async function makeHttpRequestAsync(
  options: http.RequestOptions,
  targetUrl: URL,
  requestBody: string,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = makeHttpRequest(options, targetUrl);

    req.on("response", resolve);
    req.on("error", (error) => {
      logger.error(`[HTTP Request] Request error: ${error}`);
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
}
