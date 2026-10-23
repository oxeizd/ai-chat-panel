export interface SSEMessage {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

/**
 * Нормализует пользовательский разделитель сообщений: literal "\n" / "\r" -> переводы строк.
 */
function normalizeDelimiter(delimiter: string): string {
  return delimiter.replace(/\\r/g, '\r').replace(/\\n/g, '\n');
}

/**
 *  SSE Parser
 *
 *  Поддерживает настройки:
 *  - delimiter — разделитель между SSE-сообщениями (по умолчанию '\n\n'); пустая строка = не требуется.
 *  - dataPrefix — префикс данных (по умолчанию 'data: '); например 'data_stream:' для нестандартных серверов.
 */
export class SSEParser {
  private buffer = '';
  private dataLines: string[] = [];
  private readonly delimiter: string;
  private readonly dataField: string;
  private readonly stripLeadingSpace: boolean;

  constructor(options?: { delimiter?: string; dataPrefix?: string }) {
    const rawDelimiter = options?.delimiter;
    // undefined = дефолт '\n\n'; '' = сообщений разделять нечем (каждое data-событие само по себе).
    this.delimiter = rawDelimiter === undefined || rawDelimiter === null ? '\n\n' : normalizeDelimiter(rawDelimiter);

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
      // По спецификации WHATWG SSE удаляется ровно один ведущий пробел.
      if (value.startsWith(' ') && this.stripLeadingSpace) {
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
    this.buffer += chunk;
    const messages: SSEMessage[] = [];
    let currentMessage: Partial<SSEMessage> = {};

    if (this.delimiter === '') {
      // Без разделителя: каждая data-линия — самостоятельное сообщение.
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        const isTerminator = this.processLine(line, currentMessage);
        if (this.dataLines.length > 0) {
          messages.push({
            data: this.dataLines.join('\n'),
            event: currentMessage.event,
            id: currentMessage.id,
            retry: currentMessage.retry,
          });
          currentMessage = {};
          this.dataLines = [];
        } else if (isTerminator) {
          currentMessage = {};
        }
      }
      return messages;
    }

    // Режем буфер по настроенному разделителю; последняя (неполная) часть остаётся в буфере.
    // CRLF-нормализация: если разделитель содержит '\n', приводим \r\n -> \n, чтобы найти его корректно.
    let delimiter = this.delimiter;
    let buffer = this.buffer;
    if (delimiter.includes('\n')) {
      buffer = buffer.replace(/\r\n/g, '\n');
      delimiter = delimiter.replace(/\r\n/g, '\n');
    } else if (delimiter.includes('\r')) {
      buffer = buffer.replace(/\n\r/g, '\r');
    }
    this.buffer = buffer;

    let idx: number;
    while ((idx = this.buffer.indexOf(delimiter)) !== -1) {
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + delimiter.length);
      for (const line of block.split(/\r?\n/)) {
        this.processLine(line, currentMessage);
      }
      if (Object.keys(currentMessage).length > 0 || this.dataLines.length > 0) {
        messages.push({
          data: this.dataLines.join('\n'),
          event: currentMessage.event,
          id: currentMessage.id,
          retry: currentMessage.retry,
        });
      }
      currentMessage = {};
      this.dataLines = [];

      // Стандартный SSE-дефолт '\n\n': дополнительно чистим пустые линии, чтобы не плодить
      // фантомные сообщения из повторяющихся переводов строк ('\n\n\n\n' и т.п.).
      if (this.delimiter === '\n\n') {
        while (this.buffer.startsWith('\n')) {
          this.buffer = this.buffer.slice(1);
        }
      }
    }
    return messages;
  }

  flush(): SSEMessage[] {
    // Добираем остаток буфера (поток мог оборваться без завершающего разделителя).
    const remaining = this.buffer;
    this.buffer = '';
    const currentMessage: Partial<SSEMessage> = {};
    if (remaining !== '') {
      const lines = remaining.split(/\r?\n/);
      if (this.delimiter !== '') {
        for (const line of lines) {
          this.processLine(line, currentMessage);
        }
      } else if (this.dataLines.length > 0) {
        // При delimiter='' незавершённая линия дописывается к последнему сообщению.
        this.processLine(remaining, currentMessage);
      } else {
        for (const line of lines) {
          this.processLine(line, currentMessage);
        }
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
