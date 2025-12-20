/**
 * API Key Hook tRPC Server
 *
 * This server adds an API key header to all requests for authentication
 */

import * as process from "node:process";
import { startHookServer } from "@civic/hook-common";
import { ApiKeyHook } from "./hook.js";

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 33010;
const API_KEY = process.env.API_KEY || "test-api-key-12345";
const HEADER_NAME = process.env.API_KEY_HEADER || "X-API-Key";

// Create the API key hook
const apiKeyHook = new ApiKeyHook({
  apiKey: API_KEY,
  headerName: HEADER_NAME,
});

console.log(`Starting API Key Hook Server on port ${PORT}`);
console.log("\nConfiguration:");
console.log(`- Header name: ${HEADER_NAME}`);
console.log(
  `- API key: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`,
);
console.log("\nReady to add authentication headers!");

// Start the server
startHookServer(apiKeyHook, PORT);

export type { ApiKeyHookConfig } from "./hook.js";
// Export for programmatic use
export { ApiKeyHook } from "./hook.js";
