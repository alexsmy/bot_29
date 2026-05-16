# Agent tunnel for server-side tasks

Этот канал нужен для команд из OpenCode и любых других клиентов, которые должны отправлять задания серверным агентам.

## HTTP endpoint

`POST` или `GET`:

`/api/agents/inbox`

## Поддерживаемые входные варианты

### JSON body

```json
{
  "agent": "test_echo",
  "query": "Сформируй короткий ответ в JSON",
  "args": {
    "priority": "low"
  },
  "kind": "single",
  "response_format": "json"
}
```

### Query string

```text
/api/agents/inbox?agent=test_echo&query=Сформируй%20ответ
```

Также поддерживается:

- `payload=<json>`
- `data=<base64url(json)>`
- `text=...`
- `input=...`

## Что делает тестовый агент

Тестовый агент `test_echo`:

- принимает строку запроса;
- формирует JSON-ответ;
- пишет ответ в `data/filevault_uploads/` как обычный файл, видимый в файловом менеджере;
- дополнительно сохраняет служебные записи в `data/agents/inbox`, `data/agents/outbox`, `data/agents/archive`.

## Переменные окружения

- `AGENTS_TUNNEL_SECRET` — секрет для заголовка `X-Agents-Tunnel-Secret`
- `PORT` — порт сервиса на Render

## Пример запроса

```bash
curl -X POST "https://your-render-app.onrender.com/api/agents/inbox"   -H "Content-Type: application/json"   -H "X-Agents-Tunnel-Secret: your-secret"   -d '{
    "agent": "test_echo",
    "query": "Создай файл-ответ для проверки",
    "args": {
      "source": "opencode"
    }
  }'
```

После запроса в корне файлаvault появится JSON-файл вида:

`agent-response-test_echo-<request_id>.json`
