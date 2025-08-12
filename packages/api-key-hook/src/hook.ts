/**
 * API Key Hook Implementation
 *
 * Adds an API key header to all requests for authentication
 */

import {
  AbstractHook,
  type CallToolRequestWithContext,
  type InitializeRequestHookResult,
  type InitializeRequestWithContext,
  type ListToolsRequestHookResult,
  type ListToolsRequestWithContext,
  type RequestContext,
  type CallToolRequestHookResult,
} from "@civic/hook-common";

export interface ApiKeyHookConfig {
  apiKey: string;
  headerName?: string;
}

export class ApiKeyHook extends AbstractHook {
  private readonly apiKey: string;
  private readonly headerName: string;

  constructor(config: ApiKeyHookConfig) {
    super();
    this.apiKey = config.apiKey;
    this.headerName = config.headerName || "X-API-Key";
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "ApiKeyHook";
  }

  /**
   * Process an incoming tool call request to add API key header
   */
  async processToolCallRequest(
    request: CallToolRequestWithContext,
  ): Promise<CallToolRequestHookResult> {
    return this.addApiKeyHeader(request);
  }

  /**
   * Process a tools/list request to add API key header
   */
  async processToolsListRequest(
    request: ListToolsRequestWithContext,
  ): Promise<ListToolsRequestHookResult> {
    return this.addApiKeyHeader(request);
  }

  /**
   * Process an initialize request to add API key header
   */
  async processInitializeRequest(
    request: InitializeRequestWithContext,
  ): Promise<InitializeRequestHookResult> {
    return this.addApiKeyHeader(request);
  }

  /**
   * Add API key header to request context
   */
  private addApiKeyHeader<T extends { requestContext?: RequestContext }>(
    request: T,
  ): { resultType: "continue"; request: T } {
    console.log(`[${this.name}] Adding API key header: ${this.headerName}`);

    const existingHeaders = request.requestContext?.headers || {};

    return {
      resultType: "continue",
      request: {
        ...request,
        requestContext: {
          ...request.requestContext,
          headers: {
            ...existingHeaders,
            [this.headerName]: this.apiKey,
          },
        },
      },
    };
  }
}
