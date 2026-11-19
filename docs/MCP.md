# MCP-сервер DevNotes для Claude Code

MCP-сервер работает на вашем компьютере и даёт Claude Code читать и создавать карточки
DevNotes. Например: «найди баги в этом проекте и заведи карточки в DevNotes». Карточки от
Claude Code всегда попадают в «На проверку» на сайте: их нужно принять вручную.

Сервер ходит в те же Google Таблицы, что и сайт, с той же областью доступа `drive.file`,
но через отдельный OAuth-клиент типа «Desktop app».

## 1. OAuth-клиент «Desktop app»

Делается один раз, в том же проекте Google Cloud, что и сайт (шаги 1–7 из
[SETUP_GOOGLE.md](SETUP_GOOGLE.md) уже выполнены).

1. Откройте https://console.cloud.google.com/auth/clients и проверьте, что вверху выбран
   проект `DevNotes`.
2. **Create client** → **Application type**: **Desktop app**, **Name**: `DevNotes MCP`.
3. **Create**. В окне с результатом скопируйте **Client ID** и **Client secret**.

Для десктоп-клиентов Google не считает client secret настоящим секретом: он всё равно
лежит на компьютере пользователя. Но в репозиторий и в чат его класть не нужно.

## 2. Куда положить Client ID и secret

Создайте файл `config.json` в папке настроек сервера:

| Система | Папка                                             |
| ------- | ------------------------------------------------- |
| Windows | `%APPDATA%\devnotes-mcp`                          |
| macOS   | `~/Library/Application Support/devnotes-mcp`      |
| Linux   | `~/.config/devnotes-mcp` (или `$XDG_CONFIG_HOME`) |

Содержимое:

```json
{
  "clientId": "…apps.googleusercontent.com",
  "clientSecret": "…"
}
```

Вместо файла можно задать переменные окружения `DEVNOTES_GOOGLE_CLIENT_ID` и
`DEVNOTES_GOOGLE_CLIENT_SECRET`. Другую папку настроек задаёт `DEVNOTES_MCP_HOME`.

## 3. Сборка

Нужен Node.js 22.12 или новее. В корне репозитория:

```bash
npm install
npm run build
```

Сервер собирается в `packages/mcp/dist/index.js`.

## 4. Вход

```bash
node packages/mcp/dist/index.js login
```

Откроется браузер со входом в Google. Войдите тем же аккаунтом, что и на сайте, и
разрешите доступ. После входа в папке настроек появится `token.json` с refresh-токеном,
доступным только вашему пользователю. Выйти и отозвать доступ:
`node packages/mcp/dist/index.js logout`.

Проверить, что сервер видит таблицы сайта:

```bash
node packages/mcp/dist/index.js check
```

Команда находит личную таблицу DevNotes и читает таблицы всех проектов из списка.
