import { Readable, Writable } from "node:stream";
import {
  ReadBuffer,
  serializeMessage,
} from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * Helper class for managing stdio communication in integration tests.
 * Provides utilities for sending messages, waiting for responses, and managing buffers.
 */
export class StdioTestHelper {
  private clientOutputBuffer: ReadBuffer;
  private serverStdin: Readable;
  private serverStdout: Writable;
  private messageId = 1;

  constructor() {
    // Create input stream
    this.serverStdin = new Readable({
      read: () => {}, // We'll use push() instead
    });

    // Create output buffer and stream
    this.clientOutputBuffer = new ReadBuffer();
    this.serverStdout = new Writable({
      write: (chunk, _encoding, callback) => {
        this.clientOutputBuffer.append(chunk);
        callback();
      },
    });
  }

  /**
   * Get the stdin stream for the server
   */
  getStdin(): Readable {
    return this.serverStdin;
  }

  /**
   * Get the stdout stream for the server
   */
  getStdout(): Writable {
    return this.serverStdout;
  }

  /**
   * Get the next message ID and increment the counter
   */
  getNextMessageId(): number {
    return this.messageId++;
  }

  /**
   * Send a message to the server via stdin
   */
  sendMessage(message: JSONRPCMessage): void {
    this.serverStdin.push(serializeMessage(message));
  }

  /**
   * Wait for a message to be available in the output buffer
   * @param timeoutMs Maximum time to wait for a message (default: 5000ms)
   * @returns The message if available, undefined if timeout reached
   */
  async waitForMessage(timeoutMs = 5000): Promise<JSONRPCMessage | undefined> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const message = this.clientOutputBuffer.readMessage();
      if (message) {
        return message;
      }
      // Small delay before checking again
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return undefined;
  }

  /**
   * Send a message and wait for a response
   * @param message The message to send
   * @param timeoutMs Maximum time to wait for response
   * @returns The response message
   */
  async sendAndWaitForResponse(
    message: JSONRPCMessage,
    timeoutMs = 5000,
  ): Promise<JSONRPCMessage | undefined> {
    this.sendMessage(message);
    return this.waitForMessage(timeoutMs);
  }

  /**
   * Read a message without waiting (returns immediately)
   * @returns The message if available, undefined otherwise
   */
  readMessage(): JSONRPCMessage | undefined {
    return this.clientOutputBuffer.readMessage() ?? undefined;
  }

  /**
   * Clear the output buffer
   */
  clearBuffer(): void {
    // Read all messages until buffer is empty
    while (this.clientOutputBuffer.readMessage()) {
      // Continue reading
    }
  }
}
