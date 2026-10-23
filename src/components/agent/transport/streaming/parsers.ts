export interface SSEMessage {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

/**
 *  SSE Parser (стандартный WHATWG SSE)
 *
 *  Сообщения всегда разделяются пустой линией ('\n\n'), линии — '\n' (CRLF/CR нормализуются).
 *  Поддерживаемые настройки:
 *  - dataPrefix — префикс данных (по умолчанию 'data: '); например 'data_stream:' для нестандартных серверов.
 */
export class SSEParser {
  private buffer = '';
  private dataLines: string[] = [];
  private readonly dataField: string;
  private readonly stripLeadingSpace: boolean;

  constructor(options?: { dataPrefix?: string }) {
    const prefix = options?.dataPrefix ?? 'data: ';
    if (prefix.trimEnd() === '') {
      // Поток без префикса вообще: каждая линия трактуется как data.
      this.dataField = '';
      this.stripLeadingSpace = false;
    } else {
      // Имя поля берём ДО двоеточия: 'data: ' -> 'data', 'data_stream:' -> 'data_stream'.
      const colonIdx = prefix.indexOf(':');
      this.dataField = colonIdx === -1 ? prefix.trimEnd() : prefix.slice(0, colonIdx);
      // Ровно один ведущий пробел после значения поля удаляется всегда (спецификация WHATWG SSE),
      // независимо от того, указан ли пробел в настройке префикса.
      this.stripLeadingSpace = true;
    }
  }

  /** Разбирает одну линию потока; возвращает true, если линия завершает текущее сообщение. */
  private processLine(line: string, currentMessage: Partial<SSEMessage>): boolean {
    if (line === '') {
      return true; // пустая линия всегда завершает сообщение (стандартный SSE)
    }
    if (line.startsWith(':')) {
      return false; // комментарий
    }

    const colonIdx = line.indexOf(':');
    let field: string, value: string;
    if (colonIdx === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      // Ровно один ведущий пробел после значения поля удаляется всегда (спецификация WHATWG SSE).
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    }

    switch (field) {
      case 'event':
        currentMessage.event = value;
        break;
      case 'id':
        currentMessage.id = value;
        break;
      case 'retry':
        currentMessage.retry = parseInt(value, 10);
        break;
      default:
        // Линия с неизвестным полем (или без поля при пустом префиксе) считается data.
        if (this.dataField === '' || field === this.dataField) {
          this.dataLines.push(colonIdx === -1 ? line : value);
        }
    }
    return false;
  }

  feed(chunk: string): SSEMessage[] {
    // Нормализуем CRLF/CR -> LF, затем режем на линии; неполная последняя линия остаётся в буфере.
    this.buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const messages: SSEMessage[] = [];
    let currentMessage: Partial<SSEMessage> = {};

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const isTerminator = this.processLine(line, currentMessage);
      // Сообщение выдаётся только на пустой линии (терминаторе) — так multiple data-линии
      // одного события склеиваются через '\n' (WHATWG SSE).
      if (isTerminator) {
        if (this.dataLines.length > 0 || Object.keys(currentMessage).length > 0) {
          messages.push({
            data: this.dataLines.join('\n'),
            event: currentMessage.event,
            id: currentMessage.id,
            retry: currentMessage.retry,
          });
        }
        currentMessage = {};
        this.dataLines = [];
      }
    }
    return messages;
  }

  flush(): SSEMessage[] {
    // Добираем остаток буфера (поток мог оборваться без завершающей пустой линии).
    const remaining = this.buffer;
    this.buffer = '';
    const currentMessage: Partial<SSEMessage> = {};
    if (remaining !== '') {
      for (const line of remaining.split('\n')) {
        this.processLine(line, currentMessage);
      }
    }

    if (this.dataLines.length === 0) {
      return [];
    }
    const message: SSEMessage = { data: this.dataLines.join('\n') };
    if (currentMessage.event) {
      message.event = currentMessage.event;
    }
    if (currentMessage.id) {
      message.id = currentMessage.id;
    }
    if (currentMessage.retry !== undefined) {
      message.retry = currentMessage.retry;
    }
    this.dataLines = [];
    return [message];
  }
}

/**
 * NDJSON / JSON Lines парсер (работает для jsonl)
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
