import { TokenAuthProvider } from "@civic/auth-mcp/client";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface TestClientOptions {
  url: string;
  authProvider?: OAuthClientProvider;
  clientInfo?: {
    name: string;
    version: string;
  };
}

export async function createTestClient(
  options: TestClientOptions,
): Promise<Client> {
  const { url, authProvider, clientInfo } = options;

  const client = new Client(
    clientInfo || {
      name: "mcp-integration-test",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  // StreamableHTTPClientTransport expects a URL object as first parameter
  const urlObject = new URL(url);

  const transport = new StreamableHTTPClientTransport(urlObject, {
    authProvider,
  });
  await client.connect(transport);

  return client;
}

export async function createAuthenticatedClient(
  url: string,
  token: string,
): Promise<Client> {
  return createTestClient({
    url,
    authProvider: new TokenAuthProvider(token),
  });
}

export async function createUnauthenticatedClient(
  url: string,
): Promise<Client> {
  return createTestClient({ url });
}
