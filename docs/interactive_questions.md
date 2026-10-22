# Interactive Activities — AG-UI Standard

Интерактивные активности — это UI-виджеты (кнопки, формы), которые агент может отправить пользователю для получения ввода. Отображаются в зоне ввода (вместо textarea), пока пользователь не ответил.

## Стандарт AG-UI

Интерактивные активности отправляются через событие `ACTIVITY_SNAPSHOT` с `activityType: "interactive"`:

```
event: ACTIVITY_SNAPSHOT
data: {
  "type": "ACTIVITY_SNAPSHOT",
  "messageId": "msg-1",
  "activityType": "interactive",
  "content": {
    "actions": [...],
    "form": [...],
    "submitLabel": "Отправить"
  }
}
```

## Структура

### `actions` — Кнопки-действия

Массив кнопок, при клике на которые отправляется значение как сообщение пользователя.

```json
{
  "actions": [
    {
      "label": "Да",
      "value": "yes",
      "allowCustom": false
    },
    {
      "label": "Другое...",
      "value": "",
      "allowCustom": true
    }
  ]
}
```

| Поле          | Тип       | Описание                                                                |
| ------------- | --------- | ----------------------------------------------------------------------- |
| `label`       | `string`  | Текст кнопки                                                            |
| `value`       | `string`  | Значение, отправляемое при клике. Если не задано — используется `label` |
| `allowCustom` | `boolean` | Если `true` — при клике появляется текстовое поле для своего ответа     |

### `form` — Форма с полями

Массив полей формы, которые пользователь заполняет и отправляет одной кнопкой.

```json
{
  "form": [
    {
      "name": "email",
      "label": "Email",
      "type": "text",
      "placeholder": "user@example.com",
      "required": true
    },
    {
      "name": "priority",
      "label": "Приоритет",
      "type": "select",
      "options": ["low", "medium", "high"],
      "required": true
    }
  ],
  "submitLabel": "Отправить"
}
```

| Поле          | Тип        | Описание                                         |
| ------------- | ---------- | ------------------------------------------------ |
| `name`        | `string`   | Уникальный идентификатор поля                    |
| `label`       | `string`   | Отображаемый лейбл                               |
| `type`        | `string`   | Тип поля: `text`, `number`, `textarea`, `select` |
| `placeholder` | `string`   | Плейсхолдер для пустого поля                     |
| `options`     | `string[]` | Варианты для `type: "select"`                    |
| `required`    | `boolean`  | Если `true` — поле обязательно для заполнения    |

### `submitLabel` — Текст кнопки отправки

```json
{
  "submitLabel": "Отправить"
}
```

## Примеры

### Пример 1: Выбор из списка

**Агент отправляет:**

```
event: ACTIVITY_SNAPSHOT
data: {
  "type": "ACTIVITY_SNAPSHOT",
  "messageId": "msg-1",
  "activityType": "interactive",
  "content": {
    "actions": [
      {"label": "Построй график", "value": "build_chart"},
      {"label": "Сгенерируй данные", "value": "generate_data"},
      {"label": "Другое...", "value": "", "allowCustom": true}
    ]
  }
}
```

**Результат:** Пользователь видит 3 кнопки. При клике на "Другое..." появляется текстовое поле.

### Пример 2: Форма с полями

**Агент отправляет:**

```
event: ACTIVITY_SNAPSHOT
data: {
  "type": "ACTIVITY_SNAPSHOT",
  "messageId": "msg-2",
  "activityType": "interactive",
  "content": {
    "form": [
      {
        "name": "count",
        "label": "Количество строк",
        "type": "number",
        "placeholder": "1000",
        "required": true
      },
      {
        "name": "format",
        "label": "Формат",
        "type": "select",
        "options": ["csv", "json", "parquet"],
        "required": true
      }
    ],
    "submitLabel": "Сгенерировать"
  }
}
```

**Результат:** Пользователь видит форму с двумя полями и кнопкой "Сгенерировать".

### Пример 3: Кнопки + Форма

**Агент отправляет:**

```
event: ACTIVITY_SNAPSHOT
data: {
  "type": "ACTIVITY_SNAPSHOT",
  "messageId": "msg-3",
  "activityType": "interactive",
  "content": {
    "actions": [
      {"label": "Повторить", "value": "retry"},
      {"label": "Новый запрос", "value": "new_request"}
    ],
    "form": [
      {
        "name": "comment",
        "label": "Комментарий",
        "type": "textarea",
        "placeholder": "Добавьте комментарий..."
      }
    ]
  }
}
```

**Результат:** Пользователь видит кнопки действий и форму для комментария.

## Обратная совместимость

Старый формат (`options` / `fields`) поддерживается для обратной совместимости:

```json
{
  "options": [{ "label": "Да", "value": "yes" }],
  "fields": [{ "name": "comment", "type": "text" }]
}
```

Плагин автоматически маппит старый формат на новый:

- `options` → `actions`
- `fields` → `form`

## Нестриминговый режим (JSON response)

Для нестримовых запросов интерактивные активности можно вернуть в теле ответа через `interactiveField`:

```json
{
  "text": "Что вы хотите сделать?",
  "interactive": {
    "actions": [
      { "label": "Да", "value": "yes" },
      { "label": "Нет", "value": "no" }
    ]
  }
}
```

В настройках endpoint укажите `interactiveField: "interactive"` (или другой путь, где лежит объект).

## Обновление через ACTIVITY_DELTA

Для инкрементального обновления интерактивной активности используется событие `ACTIVITY_DELTA` с JSON Patch (RFC 6902):

```
event: ACTIVITY_DELTA
data: {
  "type": "ACTIVITY_DELTA",
  "messageId": "msg-1",
  "activityType": "interactive",
  "patch": [
    {"op": "replace", "path": "/submitLabel", "value": "Готово"}
  ]
}
```

## Типы событий в EventBus

| Событие       | Payload               | Описание                                |
| ------------- | --------------------- | --------------------------------------- |
| `interactive` | `InteractiveActivity` | Интерактивная активность (кнопки/форма) |
| `custom`      | `Record<string, any>` | Кастомное событие (графики и т.д.)      |

## Интерфейсы TypeScript

```typescript
interface ActionEntry {
  label: string;
  value?: string;
  allowCustom?: boolean;
}

interface FormField {
  name: string;
  label?: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface InteractiveActivity {
  actions?: ActionEntry[];
  form?: FormField[];
  submitLabel?: string;
}
```

## Пример интеграции с агентом (Python)

```python
import json

# Отправка интерактивной активности через SSE
def send_interactive_activity(writer, activity: InteractiveActivity):
    event = {
        "type": "ACTIVITY_SNAPSHOT",
        "messageId": "msg-1",
        "activityType": "interactive",
        "content": {
            "actions": [
                {"label": "Да", "value": "yes"},
                {"label": "Нет", "value": "no"}
            ]
        }
    }
    writer.write(f"event: ACTIVITY_SNAPSHOT\n")
    writer.write(f"data: {json.dumps(event)}\n\n")
    writer.flush()
```

## Пример интеграции с агентом (Node.js)

```javascript
// Отправка интерактивной активности через SSE
function sendInteractiveActivity(res, activity) {
  const event = {
    type: 'ACTIVITY_SNAPSHOT',
    messageId: 'msg-1',
    activityType: 'interactive',
    content: {
      actions: [
        { label: 'Да', value: 'yes' },
        { label: 'Нет', value: 'no' },
      ],
    },
  };
  res.write(`event: ACTIVITY_SNAPSHOT\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
```
