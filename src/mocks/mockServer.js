/**
 * Mock AG-UI сервер для тестирования истории диалогов.
 *
 * Запуск:
 *   node src/mocks/mockServer.js
 *
 * Эндпоинты:
 *   GET  http://localhost:3456/api/threads       — список тредов
 *   GET  http://localhost:3456/api/threads/:id   — загрузка треда
 *   POST http://localhost:3456/api/chat          — стриминг (SSE)
 */

const http = require('http');

const PORT = 3456;

// Хранилище сообщений по тред ID
const THREAD_MESSAGES = {};

const THREADS = [
  {
    thread_id: '52e82f43-9b0c-408f-a7c1-25b07da92b09',
    title: 'Сгенерируй датасет на 100000 строк по продажам',
    run_count: 9,
    task_count: 9,
    last_run_at: '2026-10-21T10:42:42.152711+00:00',
    last_status: 'cancelled',
    active_run_id: null,
  },
  {
    thread_id: '7642a94e-f2bf-4b05-bc88-9485d13e1648',
    title: 'Построй график гиперболы',
    run_count: 1,
    task_count: 1,
    last_run_at: '2026-10-21T10:10:34.312377+00:00',
    last_status: 'completed',
    active_run_id: null,
  },
  {
    thread_id: '7a333410-463d-49dc-a7ea-05aa86af1751',
    title: 'нарисуй график гиперболы',
    run_count: 1,
    task_count: 1,
    last_run_at: '2026-10-21T08:09:03.807321+00:00',
    last_status: 'cancelled',
    active_run_id: null,
  },
  {
    thread_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    title: 'Парабола y = x^2',
    run_count: 3,
    task_count: 3,
    last_run_at: '2026-10-22T09:00:00+00:00',
    last_status: 'completed',
    active_run_id: null,
  },
];

// Предзаполняем сообщения для существующих тредов
THREAD_MESSAGES['52e82f43-9b0c-408f-a7c1-25b07da92b09'] = [
  {
    role: 'user',
    text: 'Сгенерируй датасет на 100000 строк по продажам. Нужны регионы, магазины, категории, размеры.',
  },
  { role: 'assistant', text: 'Готово! Вот датасет с полями: Регион, Магазин, Категория, Размер, Цена, Продажи.' },
];
THREAD_MESSAGES['7642a94e-f2bf-4b05-bc88-9485d13e1648'] = [
  { role: 'user', text: 'Построй график гиперболы' },
  { role: 'assistant', text: 'Вот график гиперболы y = 1/x' },
];
THREAD_MESSAGES['7a333410-463d-49dc-a7ea-05aa86af1751'] = [
  { role: 'user', text: 'нарисуй график гиперболы' },
  { role: 'assistant', text: 'Рисую график...' },
];
THREAD_MESSAGES['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] = [
  {
    role: 'user',
    text: 'нарисуй график параболы',
  },
  {
    role: 'assistant',
    text: 'Вот график y = x²',
    traceSteps: [
      { type: 'step:start', timestamp: Date.now(), stepName: 'context_refiner' },
      { type: 'text:start', timestamp: Date.now(), messageId: 'msg-hist-1', role: 'assistant' },
      { type: 'text:chunk', timestamp: Date.now(), messageId: 'msg-hist-1', delta: 'Вот график y = x²' },
      { type: 'text:end', timestamp: Date.now(), messageId: 'msg-hist-1' },
      { type: 'step:end', timestamp: Date.now(), stepName: 'context_refiner' },
      { type: 'step:start', timestamp: Date.now(), stepName: 'dataset_planner' },
      {
        type: 'custom',
        timestamp: Date.now(),
        data: {
          type: 'CUSTOM',
          chart: {
            type: 'line',
            title: 'Парабола y = x²',
            data: Array.from({ length: 21 }, (_, i) => ({ x: i - 10, y: Math.pow(i - 10, 2) })),
            xAxis: 'x',
            yAxis: 'y',
          },
        },
      },
      { type: 'step:end', timestamp: Date.now(), stepName: 'dataset_planner' },
    ],
  },
  {
    role: 'assistant',
    text: 'Данные для графика:\nx | y\n-10 | 100\n-9 | 81\n...',
    traceSteps: [
      { type: 'text:start', timestamp: Date.now(), messageId: 'msg-hist-2', role: 'assistant' },
      {
        type: 'text:chunk',
        timestamp: Date.now(),
        messageId: 'msg-hist-2',
        delta: 'Данные для графика:\nx | y\n-10 | 100\n-9 | 81\n...',
      },
      { type: 'text:end', timestamp: Date.now(), messageId: 'msg-hist-2' },
    ],
  },
];

// SSE события для стриминга
const SSE_EVENTS = [
  'event: RUN_STARTED\ndata: {"type":"RUN_STARTED","threadId":"{{threadId}}","runId":"run-1"}\n\n',
  'event: STEP_STARTED\ndata: {"type":"STEP_STARTED","stepName":"planner"}\n\n',
  'event: TEXT_MESSAGE_START\ndata: {"type":"TEXT_MESSAGE_START","messageId":"msg-1","role":"assistant"}\n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"Привет! Я "}  \n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"AG-UI "}  \n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"бот. "}  \n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"Чем могу помочь?"}\n\n',
  'event: TEXT_MESSAGE_END\ndata: {"type":"TEXT_MESSAGE_END","messageId":"msg-1"}\n\n',
  'event: STEP_FINISHED\ndata: {"type":"STEP_FINISHED","stepName":"planner"}\n\n',
  'event: STEP_STARTED\ndata: {"type":"STEP_STARTED","stepName":"dataset_planner"}\n\n',
  'event: TEXT_MESSAGE_START\ndata: {"type":"TEXT_MESSAGE_START","messageId":"msg-chart-1","role":"assistant"}\n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-chart-1","delta":"Генерирую данные для графика..."}  \n\n',
  'event: TEXT_MESSAGE_END\ndata: {"type":"TEXT_MESSAGE_END","messageId":"msg-chart-1"}\n\n',
  'event: STEP_FINISHED\ndata: {"type":"STEP_FINISHED","stepName":"dataset_planner"}\n\n',
  // CUSTOM событие с чартом
  'event: CUSTOM\ndata: {"type":"CUSTOM","chart":{"type":"line","title":"График параболы y = x²","data":[{"x":0,"y":0},{"x":1,"y":1},{"x":2,"y":4},{"x":3,"y":9},{"x":4,"y":16},{"x":5,"y":25},{"x":6,"y":36},{"x":7,"y":49},{"x":8,"y":64},{"x":9,"y":81},{"x":10,"y":100},{"x":-1,"y":1},{"x":-2,"y":4},{"x":-3,"y":9},{"x":-4,"y":16},{"x":-5,"y":25},{"x":-6,"y":36},{"x":-7,"y":49},{"x":-8,"y":64},{"x":-9,"y":81},{"x":-10,"y":100}],"xAxis":"x","yAxis":"y"}}\n\n',
  'event: RUN_FINISHED\ndata: {"type":"RUN_FINISHED","runId":"run-1"}\n\n',
];

// SSE события с чартом для треда "Парабола y = x^2"
const SSE_EVENTS_WITH_CHART = [
  'event: RUN_STARTED\ndata: {"type":"RUN_STARTED","threadId":"{{threadId}}","runId":"run-2"}\n\n',
  'event: STEP_STARTED\ndata: {"type":"STEP_STARTED","stepName":"context_refiner"}\n\n',
  'event: TEXT_MESSAGE_START\ndata: {"type":"TEXT_MESSAGE_START","messageId":"msg-chart-1","role":"assistant"}\n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-chart-1","delta":"Анализирую запрос..."}  \n\n',
  `event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-chart-1","delta":"Передаю задачу на обработку ['risk_manager']"}  \n\n`,
  'event: TEXT_MESSAGE_END\ndata: {"type":"TEXT_MESSAGE_END","messageId":"msg-chart-1"}\n\n',
  'event: STEP_FINISHED\ndata: {"type":"STEP_FINISHED","stepName":"context_refiner"}\n\n',
  'event: STEP_STARTED\ndata: {"type":"STEP_STARTED","stepName":"risk_manager"}\n\n',
  'event: TEXT_MESSAGE_START\ndata: {"type":"TEXT_MESSAGE_START","messageId":"msg-chart-2","role":"assistant"}\n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-chart-2","delta":"Загружаю скилл dataset_generation..."}  \n\n',
  'event: TEXT_MESSAGE_END\ndata: {"type":"TEXT_MESSAGE_END","messageId":"msg-chart-2"}\n\n',
  'event: STEP_FINISHED\ndata: {"type":"STEP_FINISHED","stepName":"risk_manager"}\n\n',
  'event: STEP_STARTED\ndata: {"type":"STEP_STARTED","stepName":"dataset_planner"}\n\n',
  'event: TEXT_MESSAGE_START\ndata: {"type":"TEXT_MESSAGE_START","messageId":"msg-chart-3","role":"assistant"}\n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-chart-3","delta":"Генерирую датасет для параболы y = x²..."}  \n\n',
  'event: TEXT_MESSAGE_END\ndata: {"type":"TEXT_MESSAGE_END","messageId":"msg-chart-3"}\n\n',
  'event: STEP_FINISHED\ndata: {"type":"STEP_FINISHED","stepName":"dataset_planner"}\n\n',
  'event: TEXT_MESSAGE_START\ndata: {"type":"TEXT_MESSAGE_START","messageId":"msg-chart-4","role":"assistant"}\n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-chart-4","delta":"Вот график параболы y = x²\n"}  \n\n',
  'event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-chart-4","delta":"Диапазон x: от -10 до 10."}\n\n',
  'event: TEXT_MESSAGE_END\ndata: {"type":"TEXT_MESSAGE_END","messageId":"msg-chart-4"}\n\n',
  // CUSTOM событие с чартом
  'event: CUSTOM\ndata: {"type":"CUSTOM","chart":{"type":"line","title":"Парабола y = x²","data":[{"x":0,"y":0},{"x":1,"y":1},{"x":2,"y":4},{"x":3,"y":9},{"x":4,"y":16},{"x":5,"y":25},{"x":6,"y":36},{"x":7,"y":49},{"x":8,"y":64},{"x":9,"y":81},{"x":10,"y":100},{"x":-1,"y":1},{"x":-2,"y":4},{"x":-3,"y":9},{"x":-4,"y":16},{"x":-5,"y":25},{"x":-6,"y":36},{"x":-7,"y":49},{"x":-8,"y":64},{"x":-9,"y":81},{"x":-10,"y":100}],"xAxis":"x","yAxis":"y"}}\n\n',
  'event: RUN_FINISHED\ndata: {"type":"RUN_FINISHED","runId":"run-2"}\n\n',
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/threads
  if (req.method === 'GET' && pathname === '/api/threads') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ items: THREADS, total: THREADS.length }));
    return;
  }

  // GET /api/threads/:id
  if (req.method === 'GET' && pathname.startsWith('/api/threads/')) {
    const threadId = pathname.split('/').pop();
    const messages = THREAD_MESSAGES[threadId] || [];

    if (messages.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Thread not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ thread_id: threadId, messages }));
    return;
  }

  // POST /api/chat
  if (req.method === 'POST' && pathname === '/api/chat') {
    let requestBody = '';
    req.on('data', (chunk) => {
      requestBody += chunk;
    });
    req.on('end', () => {});

    // 1. Парсинг body
    let userMessage = '';
    try {
      const body = JSON.parse(requestBody);
      userMessage = body.message || body.user_input || 'Сообщение';
    } catch {}

    // 2. Генерация threadId
    const newThreadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!THREAD_MESSAGES[newThreadId]) {
      THREAD_MESSAGES[newThreadId] = [];
    }
    THREAD_MESSAGES[newThreadId].push({ role: 'user', text: userMessage });

    // 3. Выбор events
    let events = SSE_EVENTS;
    if (
      userMessage.toLowerCase().includes('парабол') ||
      userMessage.toLowerCase().includes('graph') ||
      userMessage.toLowerCase().includes('chart')
    ) {
      events = SSE_EVENTS_WITH_CHART;
    }

    // 4. Отправка
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const finalEvents = events.map((event) =>
      event.replace(/"threadId":"\{\{threadId\}\}"/g, `"threadId":"${newThreadId}"`)
    );

    finalEvents.forEach((event, i) => {
      setTimeout(() => {
        res.write(event);
      }, i * 300);
    });

    // 5. Сохранение
    setTimeout(
      () => {
        const lastContentEvent = [...finalEvents].reverse().find((e) => e.includes('TEXT_MESSAGE_CONTENT'));
        if (lastContentEvent) {
          try {
            const dataLine = lastContentEvent.split('\n').find((l) => l.startsWith('data:'));
            if (dataLine) {
              const eventData = JSON.parse(dataLine.slice(5));
              const assistantMessage = eventData.delta || eventData.content || '';
              if (THREAD_MESSAGES[newThreadId]) {
                THREAD_MESSAGES[newThreadId].push({ role: 'assistant', text: assistantMessage });
              }
            }
          } catch {}
        }

        res.end();
      },
      finalEvents.length * 300 + 100
    );
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n  🧪 Mock AG-UI server запущен на http://localhost:${PORT}\n`);
  console.log('  Эндпоинты:');
  console.log(`    GET  http://localhost:${PORT}/api/threads      — список тредов`);
  console.log(`    GET  http://localhost:${PORT}/api/threads/:id  — загрузка треда`);
  console.log(`    POST http://localhost:${PORT}/api/chat         — стриминг (SSE)\n`);
  console.log('  Треды:');
  THREADS.forEach((t) => {
    console.log(`    • ${t.thread_id} — "${t.title}" (${t.last_status})`);
  });
  console.log();
});

process.on('SIGINT', () => {
  console.log('\n  Сервер остановлен');
  server.close();
  process.exit(0);
});
