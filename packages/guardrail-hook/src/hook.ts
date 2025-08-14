/**
 * Guardrail Hook Implementation
 *
 * Implements the Hook interface for request validation and guardrails
 */

import type {
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  Hook,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

export class GuardrailHook implements Hook {
  // Example: Domain allowlist for fetch-docs MCP server
  // This is specific to fetch-docs and demonstrates how to restrict URL fetching
  // You can customize or remove this based on your MCP server's needs
  private allowedDomains: string[] = [
    "example.com",
    "github.com",
    "raw.githubusercontent.com",
  ];

  /**
   * The name of this hook
   */
  get name(): string {
    return "GuardrailHook";
  }

  /**
   * Process an incoming tool call request
   */
  async processCallToolRequest(
    request: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    const { name, arguments: toolArgs } = request.params;

    // Check for disallowed tools or operations
    if (
      name.toLowerCase().includes("delete") ||
      name.toLowerCase().includes("remove")
    ) {
      return {
        resultType: "abort",
        reason: `Tool call to '${name}' was blocked by guardrails: destructive operations are not allowed`,
      };
    }

    // Check for sensitive data in arguments (simple example)
    const argsStr = JSON.stringify(toolArgs).toLowerCase();
    if (
      argsStr.includes("password") ||
      argsStr.includes("secret") ||
      argsStr.includes("token")
    ) {
      return {
        resultType: "abort",
        reason: `Tool call to '${name}' was blocked by guardrails: sensitive data detected in arguments`,
      };
    }

    // Example: Domain validation for fetch-docs MCP server
    // This demonstrates how to restrict which domains the fetch-docs tool can access
    // Customize this logic based on your specific MCP server's requirements
    if (
      name.toLowerCase().includes("fetch") ||
      name.toLowerCase().includes("http") ||
      name.toLowerCase().includes("request")
    ) {
      // Validate URLs are from allowed domains (fetch-docs specific example)
      if (
        typeof toolArgs === "object" &&
        toolArgs !== null &&
        "url" in toolArgs &&
        typeof toolArgs.url === "string"
      ) {
        try {
          const url = new URL(toolArgs.url);

          if (
            !this.allowedDomains.some((domain) => url.hostname.endsWith(domain))
          ) {
            return {
              resultType: "abort",
              reason: `Tool call to '${name}' was blocked by guardrails: URL domain '${url.hostname}' is not in the allowed domains list`,
            };
          }
        } catch (error) {
          return {
            resultType: "abort",
            reason: `Tool call to '${name}' was blocked by guardrails: invalid URL provided`,
          };
        }
      }
    }

    // In a real implementation, you would have more sophisticated validation
    // such as checking for:
    // - Command injection
    // - Path traversal
    // - Authentication and authorization
    // - Rate limiting
    // - Data validation

    // Return the tool call without modification
    return {
      resultType: "continue",
      request,
    };
  }

  /**
   * Process a tool call response
   */
  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequest,
  ): Promise<CallToolResponseHookResult> {
    const { name } = originalCallToolRequest.params;

    // Convert response to string for analysis if it's an object
    const responseStr =
      typeof response === "object"
        ? JSON.stringify(response)
        : String(response);

    // Check for sensitive data in the response
    const sensitivePatterns = [
      /password\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /secret\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /token\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /private_key\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /api[-_]?key\s*[:=]\s*["']?[^"'\s]+["']?/i,
    ];

    // Check if any sensitive patterns are found
    for (const pattern of sensitivePatterns) {
      if (pattern.test(responseStr)) {
        return {
          resultType: "abort",
          reason: `Response from tool '${name}' was blocked by guardrails: sensitive data detected in response`,
        };
      }
    }

    // Check if response is too large (example: over 1MB)
    if (responseStr.length > 1048576) {
      // 1MB
      return {
        resultType: "continue",
        response: {
          content: [
            {
              type: "text",
              text: `Response from '${name}' was truncated: response size exceeded 1MB limit`,
            },
          ],
        },
      };
    }

    // For Image responses, you might want to validate content types or sizes
    if (typeof response === "object" && response && "content" in response) {
      const content = Array.isArray(response.content) ? response.content : [];

      // Check for image or file content
      for (const item of content) {
        if (typeof item === "object" && item && item.type === "image") {
          console.log(
            `Validated ${item.type} content in response from '${name}'`,
          );
          // Here you might do additional validation based on the content type
        }
      }
    }

    // Return response without modification
    return {
      resultType: "continue",
      response: response,
    };
  }
}
