// Быстрая проверка SSEParser на типичном AG-UI потоке: data:\n\n (БЕЗ пробела!)
class SSEParser {
  constructor(options) {
    const rawDelimiter = options?.delimiter;
    this.delimiter = rawDelimiter === undefined || rawDelimiter === null ? '\n\n' : String(rawDelimiter).replace(/\\r/g, '\r').replace(/\\n/g, '\n');
    const prefix = options?.dataPrefix ?? 'data: ';
    if (prefix.trimEnd() === '') {
      this.dataField = '';
      this.stripLeadingSpace = false;
    } else {
      this.dataField = prefix.trimEnd();
      this.stripLeadingSpace = prefix.length > this.dataField.length;
    }
    this.buffer = '';
    this.dataLines = [];
  }
  processLine(line, currentMessage) {
    if (line === '') return true;
    if (line.startsWith(':')) return false;
    const colonIdx = line.indexOf(':');
    let field, value;
    if (colonIdx === -1) { field = line; value = ''; }
    else {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.startsWith(' ') && this.stripLeadingSpace) value = value.slice(1);
    }
    switch (field) {
      case 'event': currentMessage.event = value; break;
      case 'id': currentMessage.id = value; break;
      case 'retry': currentMessage.retry = parseInt(value, 10); break;
      default:
        if (this.dataField === '' || field === this.dataField) {
          this.dataLines.push(colonIdx === -1 ? line : value);
        }
    }
    return false;
  }
  feed(chunk) {
    this.buffer += chunk;
    const messages = [];
    let currentMessage = {};
    if (this.delimiter === '') {
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        const isTerminator = this.processLine(line, currentMessage);
        if (this.dataLines.length > 0) {
          messages.push({ data: this.dataLines.join('\n'), event: currentMessage.event });
          currentMessage = {}; this.dataLines = [];
        } else if (isTerminator) { currentMessage = {}; }
      }
      return messages;
    }
    let idx;
    while ((idx = this.buffer.indexOf(this.delimiter)) !== -1) {
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + this.delimiter.length);
      for (const line of block.split(/\r?\n/)) this.processLine(line, currentMessage);
      if (Object.keys(currentMessage).length > 0 || this.dataLines.length > 0) {
        messages.push({ data: this.dataLines.join('\n'), event: currentMessage.event });
      }
      currentMessage = {}; this.dataLines = [];
      if (this.delimiter === '\n\n') {
        while (this.buffer.startsWith('\n')) this.buffer = this.buffer.slice(1);
      }
    }
    return messages;
  }
  flush() {
    const remaining = this.buffer; this.buffer = '';
    const currentMessage = {};
    if (remaining !== '') {
      const lines = remaining.split(/\r?\n/);
      if (this.delimiter !== '') {
        for (const line of lines) this.processLine(line, currentMessage);
      } else if (this.dataLines.length > 0) {
        this.processLine(remaining, currentMessage);
      } else {
        for (const line of lines) this.processLine(line, currentMessage);
      }
    }
    if (this.dataLines.length === 0) return [];
    const message = { data: this.dataLines.join('\n') };
    if (currentMessage.event) message.event = currentMessage.event;
    this.dataLines = [];
    return [message];
  }
}

const stream = [
  'data:{"type":"RUN_STARTED","runId":"r1"}\n\n',
  'data:{"type":"TEXT_MESSAGE_START","messageId":"m1"}\n\n',
  'data:{"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"Приве"}\n\n',
  'data:{"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"т!"}\n\n',
  'data:{"type":"TEXT_MESSAGE_END","messageId":"m1"}\n\n',
  'data:{"type":"RUN_FINISHED"}\n\n',
].join('');

console.log('=== ТЕСТ 1: дефолтный delimiter (\\n\\n), сервер шлет "data:" БЕЗ пробела ===');
const p1 = new SSEParser();
let got = [];
for (let i = 0; i < stream.length; i += 7) {
  got.push(...p1.feed(stream.slice(i, i + 7))); // мелкими чанками
}
got.push(...p1.flush());
console.log('сообщений распаршено:', got.length, '(ожидалось 6)');
for (const m of got) console.log(JSON.stringify(m));

console.log('\n=== ТЕСТ 2: то же, но одним большим чанком ===');
const p2 = new SSEParser();
const got2 = [...p2.feed(stream), ...p2.flush()];
console.log('сообщений распаршено:', got2.length, '(ожидалось 6)');

console.log('\n=== ТЕСТ 3: стандартный "data: " с пробелом ===');
const stream3 = stream.replace(/data:/g, 'data: ');
const p3 = new SSEParser();
const got3 = [...p3.feed(stream3), ...p3.flush()];
console.log('сообщений распаршено:', got3.length, '(ожидалось 6)');
