/**
 * Server-Sent Events (SSE) Parser
 * 
 * Parses SSE format according to the spec:
 * https://html.spec.whatwg.org/multipage/server-sent-events.html
 */

export interface SSEEvent {
  event?: string;
  data?: string;
  id?: string;
  retry?: number;
}

export class SSEParser {
  private buffer = '';
  private currentEvent: Partial<SSEEvent> = {};

  /**
   * Process a chunk of data and emit any complete events
   */
  processChunk(chunk: string): SSEEvent[] {
    this.buffer += chunk;
    const events: SSEEvent[] = [];

    // Split by newlines but keep the newlines for proper parsing
    const lines = this.buffer.split('\n');
    
    // Keep the last line in buffer if it doesn't end with newline
    if (!this.buffer.endsWith('\n')) {
      this.buffer = lines.pop() || '';
    } else {
      this.buffer = '';
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Empty line signals end of event
      if (line.trim() === '') {
        if (Object.keys(this.currentEvent).length > 0) {
          events.push({ ...this.currentEvent });
          this.currentEvent = {};
        }
        continue;
      }

      // Skip comments
      if (line.startsWith(':')) {
        continue;
      }

      // Parse field
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        // Line with just field name, no colon
        continue;
      }

      const field = line.substring(0, colonIndex);
      let value = line.substring(colonIndex + 1);
      
      // Remove leading space if present
      if (value.startsWith(' ')) {
        value = value.substring(1);
      }

      // Process field
      switch (field) {
        case 'event':
          this.currentEvent.event = value;
          break;
        
        case 'data':
          // Concatenate multiple data fields with newlines
          if (this.currentEvent.data) {
            this.currentEvent.data += '\n' + value;
          } else {
            this.currentEvent.data = value;
          }
          break;
        
        case 'id':
          this.currentEvent.id = value;
          break;
        
        case 'retry':
          const retryTime = parseInt(value, 10);
          if (!isNaN(retryTime)) {
            this.currentEvent.retry = retryTime;
          }
          break;
        
        // Ignore unknown fields
        default:
          break;
      }
    }

    return events;
  }

  /**
   * Force emit any pending event (useful when stream ends)
   */
  flush(): SSEEvent | null {
    if (Object.keys(this.currentEvent).length > 0) {
      const event = { ...this.currentEvent };
      this.currentEvent = {};
      return event;
    }
    return null;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = '';
    this.currentEvent = {};
  }
}

/**
 * Format an SSE event back to string format
 */
export function formatSSEEvent(event: SSEEvent): string {
  let output = '';
  
  if (event.event) {
    output += `event: ${event.event}\n`;
  }
  
  if (event.data) {
    // Handle multi-line data
    const dataLines = event.data.split('\n');
    for (const line of dataLines) {
      output += `data: ${line}\n`;
    }
  }
  
  if (event.id) {
    output += `id: ${event.id}\n`;
  }
  
  if (event.retry !== undefined) {
    output += `retry: ${event.retry}\n`;
  }
  
  // End event with extra newline
  output += '\n';
  
  return output;
}

/**
 * Parse SSE-formatted request body to extract JSON-RPC message
 * The MCP SDK sends requests as SSE events with JSON data
 */
export function parseSSERequest(body: string): string | null {
  const parser = new SSEParser();
  const events = parser.processChunk(body);
  const lastEvent = parser.flush();
  if (lastEvent) events.push(lastEvent);
  
  // Find the first event with JSON data
  for (const event of events) {
    if (event.data) {
      return event.data;
    }
  }
  
  return null;
}

/**
 * Check if a request is SSE format based on content type
 */
export function isSSERequest(contentType?: string): boolean {
  return contentType?.includes('text/event-stream') || false;
}