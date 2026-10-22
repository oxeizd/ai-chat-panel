import { dotGet, dotSet, applySaveToContext, safeParseJson } from '../utils';

describe('dotGet', () => {
  it('читает вложенные поля по точечному пути', () => {
    expect(dotGet({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
  });

  it('поддерживает индексные скопки choices[0].delta.content', () => {
    const obj = { choices: [{ delta: { content: 'hi' } }] };
    expect(dotGet(obj, 'choices[0].delta.content')).toBe('hi');
  });

  it('возвращает undefined при отсутствии пути или пустом path', () => {
    expect(dotGet({ a: 1 }, 'b.c')).toBeUndefined();
    expect(dotGet({ a: 1 }, undefined)).toBeUndefined();
    expect(dotGet(null, 'a')).toBeUndefined();
  });

  it('не бросает на провале посередине пути (null-safe)', () => {
    expect(dotGet({ a: null }, 'a.b.c')).toBeUndefined();
  });

  it('двумерные индексы items[0].parts[1].text', () => {
    const obj = { items: [{ parts: [{ text: 'a' }, { text: 'b' }] }] };
    expect(dotGet(obj, 'items[0].parts[1].text')).toBe('b');
  });
});

describe('dotSet', () => {
  it('пишет по существующему пути', () => {
    const obj: Record<string, any> = { a: {} };
    dotSet(obj, 'a.b', 42);
    expect(obj.a.b).toBe(42);
  });

  it('создаёт промежуточные объекты', () => {
    const obj: Record<string, any> = {};
    dotSet(obj, 'x.y.z', 'v');
    expect(obj.x.y.z).toBe('v');
  });

  it('работает с индексированным путём симметрично dotGet', () => {
    const obj: Record<string, any> = {};
    dotSet(obj, 'choices[0].delta.content', 'ok');
    expect(dotGet(obj, 'choices[0].delta.content')).toBe('ok');
  });
});

describe('applySaveToContext', () => {
  it('копирует указанные поля из источника в контекст', () => {
    const context: Record<string, any> = {};
    applySaveToContext(context, ['id', 'status'], { id: '1', status: 'done', extra: 'skip' });
    expect(context).toEqual({ id: '1', status: 'done' });
  });

  it('пропускает отсутствующие в источнике поля', () => {
    const context: Record<string, any> = {};
    applySaveToContext(context, ['missing'], { present: 1 });
    expect(context).toEqual({});
  });

  it('no-op без saves', () => {
    const context: Record<string, any> = {};
    applySaveToContext(context, undefined, { a: 1 });
    expect(context).toEqual({});
  });

  it('сохраняет falsy-значения (0, "", false), но не undefined', () => {
    const context: Record<string, any> = {};
    applySaveToContext(context, ['zero', 'empty', 'flag', 'undef'], {
      zero: 0,
      empty: '',
      flag: false,
      undef: undefined,
    });
    expect(context).toEqual({ zero: 0, empty: '', flag: false });
  });
});

describe('safeParseJson', () => {
  it('парсит валидный JSON', () => {
    expect(safeParseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('возвращает исходную строку при ошибке парсинга', () => {
    expect(safeParseJson('not json')).toBe('not json');
  });
});
