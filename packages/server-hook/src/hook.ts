/**
 * Server Hook Implementation
 *
 * Provides server-side MCP initialization handling with proper lifecycle callbacks.
 * This hook listens to client initialization messages and provides a callback
 * when the initialization process is fully complete.
 */

import {
  AbstractHook,
  type InitializeRequestHookResult,
  type InitializeRequestWithContext,
  type NotificationHookResult,
} from "@civic/hook-common";
import {
  type ClientCapabilities,
  type Implementation,
  InitializedNotificationSchema,
  McpError,
  type Notification,
  type ServerCapabilities,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Server-specific options for the hook (excludes ProtocolOptions)
 */
export interface ServerHookOptions {
  /**
   * Capabilities to advertise as being supported by this server.
   */
  capabilities?: ServerCapabilities;
  /**
   * Optional instructions describing how to use the server and its features.
   */
  instructions?: string;
}

export interface ServerHookConfig {
  /**
   * Server information (name, version) - similar to McpServer constructor
   */
  serverInfo: Implementation;

  /**
   * Optional server options - contains only server-specific options (not protocol options)
   */
  options?: ServerHookOptions;

  /**
   * Callback for when initialization has fully completed (i.e., the client has sent an `initialized` notification).
   */
  oninitialized?: () => void;
}

export class ServerHook extends AbstractHook {
  private readonly _serverInfo: Implementation;
  private readonly _options?: ServerHookOptions;
  private _isInitialized = false;
  private _clientCapabilities?: ClientCapabilities;
  private _clientInfo?: Implementation;

  /**
   * Callback for when initialization has fully completed (i.e., the client has sent an `initialized` notification).
   */
  oninitialized?: () => void;

  constructor(config: ServerHookConfig) {
    super();
    this._serverInfo = config.serverInfo;
    this._options = config.options;
    this.oninitialized = config.oninitialized;
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "ServerHook";
  }

  /**
   * Get the server information
   */
  get serverInfo(): Implementation {
    return this._serverInfo;
  }

  /**
   * Get the server options
   */
  get options(): ServerHookOptions | undefined {
    return this._options;
  }

  /**
   * Check if the server has been fully initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * After initialization has completed, this will be populated with the client's reported capabilities.
   */
  getClientCapabilities(): ClientCapabilities | undefined {
    return this._clientCapabilities;
  }

  /**
   * After initialization has completed, this will be populated with information about the client's name and version.
   */
  getClientVersion(): Implementation | undefined {
    return this._clientInfo;
  }

  /**
   * Process an incoming initialize request
   * This responds to client initialization and provides server capabilities
   */
  async processInitializeRequest(
    request: InitializeRequestWithContext,
  ): Promise<InitializeRequestHookResult> {
    console.log(`[${this.name}] Processing initialize request from client`);
    console.log(`[${this.name}] Client info:`, {
      name: request.params.clientInfo?.name,
      version: request.params.clientInfo?.version,
    });
    console.log(`[${this.name}] Server info:`, {
      name: this._serverInfo.name,
      version: this._serverInfo.version,
    });

    // Store client capabilities and info
    this._clientCapabilities = request.params.capabilities;
    this._clientInfo = request.params.clientInfo;

    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(request.params.protocolVersion)) {
      throw new McpError(
        -32000,
        `Unsupported protocol version: ${request.params.protocolVersion}`,
      );
    }

    // Respond with initialization result containing server capabilities
    return {
      resultType: "respond",
      response: {
        protocolVersion: request.params.protocolVersion,
        capabilities: this._options?.capabilities || {},
        serverInfo: this._serverInfo,
        instructions: this._options?.instructions,
      },
    };
  }

  /**
   * Process notifications, specifically watching for the "initialized" notification
   * which signals that the initialization handshake is complete
   */
  async processNotification(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    console.log(
      `[${this.name}] Processing notification: ${notification.method}`,
    );

    // Check if this is the initialized notification
    if (
      notification.method === InitializedNotificationSchema.shape.method.value
    ) {
      console.log(`[${this.name}] Client initialization completed!`);
      this._isInitialized = true;

      // Call the initialization completion callback if provided
      if (this.oninitialized) {
        console.log(`[${this.name}] Calling oninitialized callback`);
        try {
          this.oninitialized();
        } catch (error) {
          console.error(
            `[${this.name}] Error in oninitialized callback:`,
            error,
          );
        }
      }
    }

    // Always continue - this hook is for observation, not interruption
    return {
      resultType: "continue",
      notification,
    };
  }

  /**
   * Reset the initialization state (useful for testing or reconnection scenarios)
   */
  reset(): void {
    console.log(`[${this.name}] Resetting initialization state`);
    this._isInitialized = false;
    this._clientCapabilities = undefined;
    this._clientInfo = undefined;
  }
}
