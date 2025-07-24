import * as crypto from "node:crypto";
import type { Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import z from "zod";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33200;
const REQUIRED_API_KEY = process.env.API_KEY || "test-api-key-12345";

// Store server instances by session ID
export const sessions = new Map<
  string,
  {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
  }
>();

// Session ID generator
const generateSessionId = (): string => crypto.randomUUID();

// Create a new MCP server for a session
async function createMcpServerForSession(sessionId: string) {
  console.log(`Creating new server for session: ${sessionId}`);

  const server = new McpServer({
    name: "api-key-protected-server",
    version: "1.0.0",
  });

  // Register a simple echo tool
  server.tool(
    "protected-echo",
    "Echoes back the input message (requires API key)",
    {
      message: z.string().describe("Message to echo back"),
    },
    async (args) => {
      console.log(`Protected echo: ${args.message}`);
      return {
        content: [
          {
            type: "text",
            text: `Protected Echo: ${args.message}`,
          },
        ],
      };
    },
  );

  // Create transport with the session ID generator
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
  });

  await server.connect(transport);

  // Store the session
  sessions.set(sessionId, {
    server,
    transport,
  });

  return { server, transport };
}

// API Key validation middleware
function validateApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const apiKey = req.headers["x-api-key"] as string;
  
  if (!apiKey) {
    console.log("Request missing API key");
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized: Missing API key",
        data: "X-API-Key header is required",
      },
    });
    return;
  }

  if (apiKey !== REQUIRED_API_KEY) {
    console.log(`Invalid API key: ${apiKey}`);
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized: Invalid API key",
        data: "Invalid X-API-Key header",
      },
    });
    return;
  }

  console.log("Valid API key provided");
  next();
}

// Create Express app
function createExpressApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // MCP endpoint with API key validation
  app.post("/mcp", validateApiKey, async (req, res) => {
    try {
      const sessionId =
        (req.headers["mcp-session-id"] as string) || generateSessionId();

      let session = sessions.get(sessionId);

      console.log(`Session ID: ${sessionId}: ${session ? "existing" : "new"}`);

      // Create new session if needed
      if (!session) {
        console.log("Creating new session for request");
        await createMcpServerForSession(sessionId);
        // biome-ignore lint/style/noNonNullAssertion: the createMcpServerForSession function guarantees the session now exists
        session = sessions.get(sessionId)!;
      }

      // Set session ID header for response
      res.setHeader("mcp-session-id", sessionId);

      // Handle the request
      console.log(`Handling request for session ${sessionId}`);
      await session.transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling request:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  });

  // Handle GET requests for SSE (also requires API key)
  app.get("/mcp", validateApiKey, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.get(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = sessions.get(sessionId)?.transport;
    await transport?.handleRequest(req, res);
  });

  // Health check endpoint (no API key required)
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      sessions: sessions.size,
      port: PORT,
      requiresApiKey: true,
    });
  });

  return app;
}

// Export function to create and start server programmatically
export async function createApiKeyProtectedServer(port: number = PORT): Promise<{
  httpServer: Server;
  sessions: Map<
    string,
    {
      server: McpServer;
      transport: StreamableHTTPServerTransport;
    }
  >;
  port: number;
  close: () => Promise<void>;
}> {
  const app = createExpressApp();

  return new Promise((resolve) => {
    const httpServer = app.listen(port, () => {
      console.log(`API Key Protected server running on port ${port}`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`Required API key: ${REQUIRED_API_KEY}`);

      resolve({
        httpServer,
        sessions,
        port,
        close: async () => {
          // Close all sessions
          for (const [sessionId, session] of sessions) {
            session.transport.close();
            session.server.close();
            sessions.delete(sessionId);
          }
          // Close HTTP server
          return new Promise((resolveClose) => {
            httpServer.close(() => resolveClose());
          });
        },
      });
    });
  });
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createApiKeyProtectedServer(PORT).catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}