# UX-agent API

Node.js / Express сервер для прототипа адаптивного UX-агента.

## Эндпоинты

| Метод | Путь | Описание |
|-------|------|-----------|
| GET | `/api/users` | Получить список пользователей |
| POST | `/api/users` | Создать пользователя |
| GET | `/api/rooms` | Получить список комнат |
| POST | `/api/rooms` | Создать комнату |
| PUT | `/api/rooms/:id/join` | Присоединиться к комнате |
| DELETE | `/api/rooms/:id` | Удалить комнату (если владелец) |
| HEAD | `/api/status` | Проверка состояния сервера |

## Локальный запуск

```bash
pip install -r api/requirements.txt
npm install
npm start
```