import { SSEParser, NdjsonParser } from '../parsers';

describe('SSEParser', () => {
  it('парсит простое data-сообщение до пустой строки', () => {
    const parser = new SSEParser();
    const messages = parser.feed('data: hello\n\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('hello');
  });

  it('склеивает несколько data-линий одного сообщения через \\n', () => {
    const parser = new SSEParser();
    const messages = parser.feed('data: line1\ndata: line2\n\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('line1\nline2');
  });

  it('извлекает event, id и retry', () => {
    const parser = new SSEParser();
    const messages = parser.feed('event: message\ndata: x\nid: 42\nretry: 3000\n\n');
    expect(messages[0]).toEqual({ data: 'x', event: 'message', id: '42', retry: 3000 });
  });

  it('игнорирует комментарии (: ...)', () => {
    const parser = new SSEParser();
    const messages = parser.feed(': keep-alive\ndata: ok\n\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('ok');
  });

  it('удаляет один ведущий пробел после двоеточия, но не больше (по спецификации WHATWG SSE)', () => {
    const parser = new SSEParser();
    const messages = parser.feed('data:  two-spaces-preserved\n\n');
    // "data:  x" -> value " x" (ровно один пробел удалён, второй остаётся)
    expect(messages[0].data).toBe(' two-spaces-preserved');
  });

  it('обрабатывает CRLF', () => {
    const parser = new SSEParser();
    const messages = parser.feed('data: hello\r\n\r\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('hello');
  });

  it('буферит недописанную линию между feed-вызовами', () => {
    const parser = new SSEParser();
    expect(parser.feed('data: hel')).toHaveLength(0);
    const messages = parser.feed('lo\n\n');
    expect(messages[0].data).toBe('hello');
  });

  it('разрывает сообщение посередине на границе чанков корректно', () => {
    const parser = new SSEParser();
    const first = parser.feed('data: a\n\ndata: b\n');
    expect(first.map((m) => m.data)).toEqual(['a']);
    const second = parser.feed('\n');
    expect(second.map((m) => m.data)).toEqual(['b']);
  });

  it('не выдаёт фантомные сообщения из повторяющихся пустых строк', () => {
    const parser = new SSEParser();
    const messages = parser.feed('\n\n\n');
    expect(messages).toHaveLength(0);
  });

  it('flush добирает незавершённое сообщение из буфера (включая последнюю data-линию)', () => {
    const parser = new SSEParser();
    parser.feed('data: partial');
    const messages = parser.flush();
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('partial');
  });

  it('flush обрабатывает несколько накопленных data-линий', () => {
    const parser = new SSEParser();
    parser.feed('data: line1\ndata: line2');
    const messages = parser.flush();
    expect(messages[0].data).toBe('line1\nline2');
  });

  it('flush на пустом парсере ничего не возвращает', () => {
    const parser = new SSEParser();
    expect(parser.flush()).toHaveLength(0);
  });

  // ---------------- dataPrefix (delimiter удалён: стандартный SSE, сообщения режутся пустой линией) ----------------

  it('кастомный dataPrefix: читает data_stream: вместо data:', () => {
    const parser = new SSEParser({ dataPrefix: 'data_stream: ' });
    const messages = parser.feed('data_stream: hello\n\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('hello');
  });

  it('dataPrefix без завершающего пробела тоже работает ("data_stream:")', () => {
    const parser = new SSEParser({ dataPrefix: 'data_stream:' });
    const messages = parser.feed('data_stream: value\n\n');
    expect(messages[0].data).toBe('value');
  });

  it('dataPrefix: стандартные event/id/retry линии не попадают в data', () => {
    const parser = new SSEParser({ dataPrefix: 'data_stream:' });
    const messages = parser.feed('event: msg\nid: 7\ndata_stream: payload\n\n');
    expect(messages[0]).toEqual({ data: 'payload', event: 'msg', id: '7', retry: undefined });
  });

  it('dataPrefix="": поток вообще без префикса — каждая линия является data', () => {
    const parser = new SSEParser({ dataPrefix: '' });
    const messages = parser.feed('{"a":1}\n{"b":2}\n\n');
    expect(messages.map((m) => m.data)).toEqual(['{"a":1}\n{"b":2}']);
  });

  it('CRLF-поток разбирается корректно (сообщения режутся пустой линией)', () => {
    const parser = new SSEParser();
    const messages = parser.feed('data: one\r\n\r\ndata: two\r\n\r\n');
    expect(messages.map((m) => m.data)).toEqual(['one', 'two']);
  });

  it('поток без завершающей пустой линии: хвост добирается в flush', () => {
    const parser = new SSEParser();
    expect(parser.feed('data: a\n\ndata: tail')).toHaveLength(1);
    expect(parser.flush().map((m) => m.data)).toEqual(['tail']);
  });

  it('дефолт сохранён: без опций парсер ведёт себя как раньше (data: + \\n\\n)', () => {
    const parser = new SSEParser();
    const messages = parser.feed('data: default\n\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('default');
  });
});

describe('NdjsonParser', () => {
  it('парсит по одному объекту на линию', () => {
    const parser = new NdjsonParser();
    const objects = parser.feed('{"a":1}\n{"b":2}\n');
    expect(objects).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('пропускает пустые линии', () => {
    const parser = new NdjsonParser();
    const objects = parser.feed('\n{"a":1}\n\n\n');
    expect(objects).toEqual([{ a: 1 }]);
  });

  it('тихо игнорирует битые JSON-линии, продолжая разбор остальных', () => {
    const parser = new NdjsonParser();
    const objects = parser.feed('{"a":1}\nnot-json\n{"b":2}\n');
    expect(objects).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('буферит неполную линию между чанками', () => {
    const parser = new NdjsonParser();
    expect(parser.feed('{"content":"he')).toHaveLength(0);
    const objects = parser.feed('llo"}\n');
    expect(objects).toEqual([{ content: 'hello' }]);
  });

  it('flush добирает последнюю линию без завершающего перевода строки', () => {
    const parser = new NdjsonParser();
    parser.feed('{"last":true}');
    expect(parser.flush()).toEqual([{ last: true }]);
  });

  it('flush с битым хвостом возвращает пустой массив', () => {
    const parser = new NdjsonParser();
    parser.feed('{"broken":');
    expect(parser.flush()).toEqual([]);
  });

  it('поддерживает CRLF', () => {
    const parser = new NdjsonParser();
    const objects = parser.feed('{"a":1}\r\n{"b":2}\r\n');
    expect(objects).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
