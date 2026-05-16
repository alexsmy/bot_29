# Telegram tunnel for Render

Этот модуль добавляет серверный шлюз для отправки Telegram-сообщений из любых приложений.

## Эндпоинт

`GET` или `POST`:

`/mytelegram`

Поддерживаемые варианты входа:

- `POST` с JSON-телом
- `GET ?payload=<json>`
- `GET ?data=<base64url(json)>`
- `GET ?text=...&format=html&kind=single`

## Поля JSON

Пример:

```json
{
  "text": "<b>Сборка завершена</b>\nФайл: report.zip",
  "format": "html",
  "kind": "single",
  "disable_web_page_preview": true
}
```

Поддерживаемые `format`:

- `html`
- `markdownv2`
- `plain`

Поддерживаемые `kind`:

- `single` — обычная отправка
- `replace` — редактирование существующего сообщения, нужен `message_id`
- `temporary` — отправка с последующим удалением через `delete_after_seconds`

## Переменные окружения

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_TUNNEL_SECRET` — секрет туннеля, передаётся в заголовке `X-Telegram-Tunnel-Secret`
- `TELEGRAM_TUNNEL_TIMEOUT_SECONDS`
- `TELEGRAM_TUNNEL_DELETE_AFTER_SECONDS`

## Пример запроса

```bash
curl -X POST "https://your-render-app.onrender.com/mytelegram" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Tunnel-Secret: your-secret" \
  -d '{
    "text": "<b>Hello</b> from Render",
    "format": "html",
    "kind": "single",
    "disable_web_page_preview": true
  }'
```
