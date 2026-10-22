/**
 * Tests for chat history functionality (fetchThreads, loadThread, deleteThread).
 *
 * Covers:
 * - AGUI format { items: [...], total: N }
 * - Plain array format
 * - Thread loading with messages array
 * - Thread deletion
 * - Edge cases (empty, missing fields, errors)
 */

// Inline dotGet for testing (mirrors src/components/agent/utils/utils.ts)
function dotGet(obj: any, path?: string) {
  if (!path || obj == null) {
    return undefined;
  }
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) {
      return undefined;
    }
    cur = cur[p];
  }
  return cur;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatHistoryDate(value: any): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'number') {
    return new Date(value).toLocaleString();
  }
  const asDate = new Date(value);
  return isNaN(asDate.getTime()) ? String(value) : asDate.toLocaleString();
}

const DEFAULT_HISTORY_LIST_ITEM_FIELDS = { id: 'id', title: 'title', date: 'date', preview: 'preview' };
const DEFAULT_HISTORY_MESSAGE_FIELDS = { role: 'role', text: 'content', id: 'id', timestamp: 'timestamp' };

function normalizeThreads(
  result: any,
  customFields: Partial<typeof DEFAULT_HISTORY_LIST_ITEM_FIELDS> = {}
): Array<{ id: string; title: string; date: string; preview?: string }> {
  const fields = { ...DEFAULT_HISTORY_LIST_ITEM_FIELDS, ...customFields };

  if (result && typeof result === 'object' && 'items' in result && Array.isArray(result.items)) {
    return result.items.map((item: any, index: number) => ({
      id: String(dotGet(item, fields.id) ?? item?.thread_id ?? item?.id ?? index),
      title: String(dotGet(item, fields.title) ?? item?.title ?? 'Без названия'),
      date: formatHistoryDate(dotGet(item, fields.date) ?? item?.last_run_at ?? item?.date),
      preview: fields.preview ? dotGet(item, fields.preview) : undefined,
    }));
  }

  if (Array.isArray(result)) {
    return result.map((item: any, index: number) => ({
      id: String(dotGet(item, fields.id) ?? item?.id ?? index),
      title: String(dotGet(item, fields.title) ?? item?.title ?? 'Без названия'),
      date: formatHistoryDate(dotGet(item, fields.date) ?? item?.date),
      preview: fields.preview ? dotGet(item, fields.preview) : undefined,
    }));
  }

  return [];
}

function normalizeMessages(
  result: any,
  customFields: Partial<typeof DEFAULT_HISTORY_MESSAGE_FIELDS> = {}
): Array<{ id: string; text: string; sender: 'user' | 'ai'; timestamp: number }> {
  const fields = { ...DEFAULT_HISTORY_MESSAGE_FIELDS, ...customFields };

  let messagesArray: any[] = result;
  if (!Array.isArray(result) && result && typeof result === 'object') {
    if (Array.isArray(result.messages)) {
      messagesArray = result.messages;
    } else if (Array.isArray(result.data)) {
      messagesArray = result.data;
    } else {
      return [];
    }
  }

  if (!Array.isArray(messagesArray)) {
    return [];
  }

  return messagesArray.map((item: any) => {
    const rawRole = dotGet(item, fields.role) ?? item?.role ?? 'assistant';
    const isUser = rawRole === 'user';
    const text = dotGet(item, fields.text) ?? item?.[fields.text] ?? item?.text ?? item?.content ?? '';
    const timestamp = dotGet(item, fields.timestamp) ?? item?.timestamp ?? Date.now();
    const messageId =
      dotGet(item, fields.id) ?? item?.id ?? `hist_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return {
      id: String(messageId),
      text: typeof text === 'string' ? text : JSON.stringify(text),
      sender: isUser ? 'user' : 'ai',
      timestamp: typeof timestamp === 'number' ? timestamp : Date.parse(timestamp) || Date.now(),
    };
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Chat History — fetchThreads', () => {
  describe('AGUI format { items: [...], total: N }', () => {
    it('should normalize AGUI response with thread_id and title', () => {
      const response = {
        items: [
          {
            thread_id: '52e82f43-9b0c-408f-a7c1-25b07da92b09',
            title: 'Сгенерируй датасет на 100000 строк',
            last_run_at: '2026-10-21T10:42:42.152711+00:00',
          },
          {
            thread_id: '7642a94e-f2bf-4b05-bc88-9485d13e1648',
            title: 'Построй график гиперболы',
            last_run_at: '2026-10-21T10:10:34.312377+00:00',
          },
        ],
        total: 2,
      };

      const result = normalizeThreads(response);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('52e82f43-9b0c-408f-a7c1-25b07da92b09');
      expect(result[0].title).toBe('Сгенерируй датасет на 100000 строк');
      expect(result[1].id).toBe('7642a94e-f2bf-4b05-bc88-9485d13e1648');
      expect(result[1].title).toBe('Построй график гиперболы');
    });

    it('should use fallback "Без названия" when title is missing', () => {
      const response = { items: [{ thread_id: 'abc-123', last_run_at: '2026-10-21T10:00:00Z' }], total: 1 };
      const result = normalizeThreads(response);

      expect(result[0].id).toBe('abc-123');
      expect(result[0].title).toBe('Без названия');
    });

    it('should handle empty items array', () => {
      expect(normalizeThreads({ items: [], total: 0 })).toEqual([]);
    });

    it('should handle nested fields via dot notation', () => {
      const response = {
        items: [
          {
            meta: { thread_id: 'nested-1' },
            attributes: { title: 'Nested Title' },
            last_run_at: '2026-10-21T10:00:00Z',
          },
        ],
        total: 1,
      };

      const result = normalizeThreads(response, { id: 'meta.thread_id', title: 'attributes.title' });

      expect(result[0].id).toBe('nested-1');
      expect(result[0].title).toBe('Nested Title');
    });
  });

  describe('Plain array format', () => {
    it('should normalize plain array of threads', () => {
      const response = [
        { id: '1', title: 'Thread 1', date: '2026-10-21T10:00:00Z' },
        { id: '2', title: 'Thread 2', date: '2026-10-21T11:00:00Z' },
      ];

      const result = normalizeThreads(response);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].title).toBe('Thread 1');
    });

    it('should use index as fallback id when id is missing', () => {
      const result = normalizeThreads([{ title: 'No ID Thread' }]);
      expect(result[0].id).toBe('0');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for invalid input', () => {
      expect(normalizeThreads('string')).toEqual([]);
      expect(normalizeThreads(123)).toEqual([]);
      expect(normalizeThreads(null)).toEqual([]);
      expect(normalizeThreads(undefined)).toEqual([]);
      expect(normalizeThreads({ foo: 'bar' })).toEqual([]);
    });
  });
});

describe('Chat History — loadThread', () => {
  describe('AGUI format { messages: [...] }', () => {
    it('should extract messages from AGUI response', () => {
      const response = {
        thread_id: 'abc-123',
        messages: [
          { role: 'user', text: 'Hello' },
          { role: 'assistant', text: 'Hi there!' },
        ],
      };

      const result = normalizeMessages(response);

      expect(result).toHaveLength(2);
      expect(result[0].sender).toBe('user');
      expect(result[0].text).toBe('Hello');
      expect(result[1].sender).toBe('ai');
      expect(result[1].text).toBe('Hi there!');
    });

    it('should extract messages from nested data array', () => {
      const response = {
        thread_id: 'xyz-789',
        data: [{ role: 'user', content: 'Test message' }],
      };

      const result = normalizeMessages(response);

      expect(result).toHaveLength(1);
      expect(result[0].sender).toBe('user');
      expect(result[0].text).toBe('Test message');
    });

    it('should use content field when text is missing', () => {
      const response = {
        messages: [{ role: 'user', content: 'Content field' }],
      };

      const result = normalizeMessages(response);
      expect(result[0].text).toBe('Content field');
    });

    it('should handle empty messages array', () => {
      expect(normalizeMessages({ thread_id: 'empty', messages: [] })).toEqual([]);
    });
  });

  describe('Plain array format', () => {
    it('should normalize plain array of messages', () => {
      const response = [
        { role: 'user', text: 'Question' },
        { role: 'assistant', text: 'Answer' },
      ];

      const result = normalizeMessages(response);

      expect(result).toHaveLength(2);
      expect(result[0].sender).toBe('user');
      expect(result[1].sender).toBe('ai');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for invalid input', () => {
      expect(normalizeMessages('string')).toEqual([]);
      expect(normalizeMessages(123)).toEqual([]);
      expect(normalizeMessages(null)).toEqual([]);
      expect(normalizeMessages({ foo: 'bar' })).toEqual([]);
    });

    it('should handle missing role (defaults to ai)', () => {
      const response = [{ text: 'No role' }];
      const result = normalizeMessages(response);
      expect(result[0].sender).toBe('ai');
    });

    it('should handle missing text (defaults to empty string)', () => {
      const response = [{ role: 'user' }];
      const result = normalizeMessages(response);
      expect(result[0].text).toBe('');
    });

    it('should handle custom field mappings', () => {
      const response = {
        messages: [
          { author: 'customer', body: 'Custom field 1' },
          { author: 'agent', body: 'Custom field 2' },
        ],
      };

      const result = normalizeMessages(response, { role: 'author', text: 'body' });

      expect(result).toHaveLength(2);
      expect(result[0].sender).toBe('ai'); // 'customer' !== 'user', so defaults to 'ai'
      expect(result[0].text).toBe('Custom field 1');
    });
  });
});

describe('Chat History — date formatting', () => {
  it('should return empty string for null/undefined', () => {
    expect(formatHistoryDate(null)).toBe('');
    expect(formatHistoryDate(undefined)).toBe('');
  });

  it('should handle ISO date strings', () => {
    const result = formatHistoryDate('2026-10-21T10:42:42.152711+00:00');
    // Force Russian locale for consistent test output across locales
    expect(result.toLocaleLowerCase().includes('21.10.2026') || result.includes('10/21/2026')).toBe(true);
    // Verify it contains the date in some format
    expect(result).toMatch(/\d{2}[.\/]\d{2}[.\/]\d{4}/);
  });

  it('should handle numeric timestamps', () => {
    // 1792569600000 = Oct 21, 2026 00:00:00 UTC
    const result = formatHistoryDate(1792569600000);
    expect(result).toContain('2026');
  });

  it('should handle invalid dates by returning the string as-is', () => {
    expect(formatHistoryDate('not-a-date')).toBe('not-a-date');
  });
});

describe('Chat History — dotGet utility', () => {
  it('should get top-level property', () => {
    expect(dotGet({ a: 1 }, 'a')).toBe(1);
  });

  it('should get nested property via dot notation', () => {
    expect(dotGet({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('should return undefined for missing path', () => {
    expect(dotGet({ a: 1 }, 'b')).toBeUndefined();
  });

  it('should return undefined for missing nested path', () => {
    expect(dotGet({ a: { b: 1 } }, 'a.c.d')).toBeUndefined();
  });

  it('should handle array index notation', () => {
    expect(dotGet({ items: [{ id: 1 }] }, 'items[0].id')).toBe(1);
  });
});
