/**
 * Hook-related Type Definitions
 */

import type { TransportError } from "@civic/hook-common";

/**
 * HTTP error response type
 */
export interface HttpErrorResponse {
  statusCode: number;
  body: string;
}

export type ForwardResult =
  | {
      type: "success";
      result: Record<string, unknown>;
      headers: Record<string, string>;
      statusCode?: number;
    }
  | {
      type: "error";
      error: TransportError;
      headers: Record<string, string>;
      statusCode?: number;
    };
