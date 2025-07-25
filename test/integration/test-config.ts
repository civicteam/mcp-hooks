export const TEST_CONFIG = {
  targetServers: {
    withoutAuth: {
      url: "http://localhost:33000",
      description: "Target MCP server without authentication",
    },
    withAuth: {
      url: "http://localhost:33008",
      description: "Target MCP server with OAuth authentication",
    },
    echo: {
      url: "http://localhost:33100",
      description: "Echo test server for ping testing",
    },
    apiKeyProtected: {
      url: "http://localhost:33201",
      description: "API key protected server",
    },
  },
  passthroughServers: {
    withoutAuth: {
      url: "http://localhost:34000/mcp",
      description: "Passthrough server pointing to target without auth",
    },
    withAuth: {
      url: "http://localhost:34008/mcp",
      description: "Passthrough server pointing to target with auth",
    },
    echo: {
      url: "http://localhost:34100/mcp",
      description: "Passthrough server pointing to echo test server",
    },
    withHooks: {
      url: "http://localhost:34200/mcp",
      description: "Passthrough server with explain hook pointing to fetchDocs",
    },
    programmatic: {
      url: "http://localhost:34101/mcp",
      description: "Passthrough server with programmatic hooks for testing",
    },
    withApiKeyHook: {
      url: "http://localhost:34400/mcp",
      description: "Passthrough server with API key hook to protected server",
    },
  },
  auth: {
    clientId: process.env.OAUTH_CLIENT_ID || "test-client-id",
    authServerUrl: process.env.AUTH_SERVER_URL || "http://localhost:3000",
  },
  timeouts: {
    connection: 5000,
    request: 10000,
    streaming: 30000,
  },
};
