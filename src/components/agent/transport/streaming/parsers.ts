export interface SSEMessage {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

/**
 *  SSE Parser
 */
export class SSEParser {
  private buffer = '';
  private dataLines: string[] = [];

  feed(chunk: string): SSEMessage[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';
    const messages: SSEMessage[] = [];
    let currentMessage: Partial<SSEMessage> = {};

    for (const line of lines) {
      if (line === '') {
        if (Object.keys(currentMessage).length > 0 || this.dataLines.length > 0) {
          messages.push({
            data: this.dataLines.join('\n'),
            event: currentMessage.event,
            id: currentMessage.id,
            retry: currentMessage.retry,
          });
          currentMessage = {};
          this.dataLines = [];
        }
        continue;
      }
      if (line.startsWith(':')) {
        continue;
      }

      const colonIdx = line.indexOf(':');
      let field: string, value: string;
      if (colonIdx === -1) {
        field = line;
        value = '';
      } else {
        field = line.slice(0, colonIdx);
        value = line.slice(colonIdx + 1);
        if (value.startsWith(' ')) {
          value = value.slice(1);
        }
      }

      switch (field) {
        case 'event':
          currentMessage.event = value;
          break;
        case 'data':
          this.dataLines.push(value);
          break;
        case 'id':
          currentMessage.id = value;
          break;
        case 'retry':
          currentMessage.retry = parseInt(value, 10);
          break;
      }
    }
    return messages;
  }

  flush(): SSEMessage[] {
    if (this.buffer.trim() === '' && this.dataLines.length === 0) {
      return [];
    }
    const message = { data: this.dataLines.join('\n') };
    this.buffer = '';
    this.dataLines = [];
    return [message];
  }
}

/**
 *  ndjsonParser
 */
export class NdjsonParser {
  private buffer = '';

  feed(chunk: string): any[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';
    const result: any[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        result.push(JSON.parse(trimmed));
      } catch {
        // ignore parse errors
      }
    }
    return result;
  }

  flush(): any[] {
    if (this.buffer.trim()) {
      try {
        const obj = JSON.parse(this.buffer);
        this.buffer = '';
        return [obj];
      } catch {
        return [];
      }
    }
    return [];
  }
}
