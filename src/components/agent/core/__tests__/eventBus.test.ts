import { EventBus } from '../eventBus';

describe('EventBus', () => {
  it('emit доставляет аргументы подписчику', () => {
    const bus = new EventBus();
    const received: string[] = [];
    bus.on('chunk', (t: string) => received.push(t));
    bus.emit('chunk', 'hello');
    expect(received).toEqual(['hello']);
  });

  it('несколько подписчиков получают событие в порядке подписки', () => {
    const bus = new EventBus();
    const order: number[] = [];
    bus.on('e', () => order.push(1));
    bus.on('e', () => order.push(2));
    bus.emit('e');
    expect(order).toEqual([1, 2]);
  });

  it('on возвращает функцию отписки', () => {
    const bus = new EventBus();
    let count = 0;
    const off = bus.on('e', () => count++);
    bus.emit('e');
    off();
    bus.emit('e');
    expect(count).toBe(1);
  });

  it('off удаляет конкретного обработчика', () => {
    const bus = new EventBus();
    const calls: string[] = [];
    const h1 = () => calls.push('h1');
    const h2 = () => calls.push('h2');
    bus.on('e', h1);
    bus.on('e', h2);
    bus.off('e', h1);
    bus.emit('e');
    expect(calls).toEqual(['h2']);
  });

  it('один падающий обработчик не блокирует остальных', () => {
    const bus = new EventBus();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const calls: string[] = [];
    bus.on('e', () => {
      throw new Error('boom');
    });
    bus.on('e', () => calls.push('survived'));
    bus.emit('e');
    expect(calls).toEqual(['survived']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emit на несуществующее событие — no-op', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nobody-listens', 1, 2)).not.toThrow();
  });

  it('clear снимает все подписки', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('a', () => count++);
    bus.on('b', () => count++);
    bus.clear();
    bus.emit('a');
    bus.emit('b');
    expect(count).toBe(0);
  });

  it('повторная подписка одной и той же функции дедуплицируется (Set)', () => {
    const bus = new EventBus();
    let count = 0;
    const handler = () => count++;
    bus.on('e', handler);
    bus.on('e', handler);
    bus.emit('e');
    expect(count).toBe(1);
  });
});
