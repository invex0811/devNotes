# Настройка Google для DevNotes

Эта инструкция — для того, кто разворачивает свою копию DevNotes: свой репозиторий на
GitHub, свой сайт на GitHub Pages и свой проект в Google Cloud. Настройка делается один
раз и занимает около 30 минут. Нужны аккаунт Google и аккаунт GitHub.

Шаги сверены с документацией Google в ноябре 2026 года. Google иногда переименовывает
кнопки в консоли; если что-то выглядит иначе, ищите по смыслу.

Дальше `<логин>` — ваш логин на GitHub, `<репозиторий>` — название вашей копии
репозитория (например, `devNotes`).

В итоге у вас будут три значения:

| Переменная              | Что это                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID` | Client ID веб-клиента OAuth, заканчивается на `.apps.googleusercontent.com` |
| `VITE_GOOGLE_API_KEY`   | API-ключ для Google Picker                                                  |
| `VITE_GOOGLE_APP_ID`    | Номер проекта Google Cloud (Project number), только цифры                   |

Все три значения попадут в код сайта, который видит любой посетитель. Так и задумано:
это не секреты, а защищают их ограничения по адресам из шагов 6 и 7. **Client secret
сайту не нужен**, никуда его не копируйте.

## 0. Репозиторий и GitHub Pages

1. Сделайте копию репозитория DevNotes у себя на GitHub (**Fork** или **Use this
   template**).
2. В копии: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Запустите публикацию: вкладка **Actions** → workflow **CI** → **Run workflow** на
   ветке `main` (или сделайте любой пуш в `main`).
4. Когда workflow закончится, сайт откроется по адресу
   `https://<логин>.github.io/<репозиторий>/`. Пока без ключей Google он предлагает
   только демо-режим — это нормально.

Адреса, которые понадобятся дальше:

| Что                                   | Адрес                                      |
| ------------------------------------- | ------------------------------------------ |
| Сайт                                  | `https://<логин>.github.io/<репозиторий>/` |
| Origin сайта (схема и домен без пути) | `https://<логин>.github.io`                |
| Локальная разработка                  | `http://localhost:5173`                    |

## 1. Создать проект в Google Cloud

1. Откройте https://console.cloud.google.com/projectcreate.
2. **Project name**: `DevNotes`. **Location** оставьте как есть (No organization).
3. Нажмите **Create** и дождитесь уведомления о создании.
4. Убедитесь, что вверху консоли, в выборе проекта, выбран `DevNotes`. Все следующие
   шаги делаются в нём.

## 2. Включить API

Для каждого из трёх API откройте ссылку, проверьте, что сверху выбран проект
`DevNotes`, и нажмите **Enable**:

- Google Sheets API: https://console.cloud.google.com/apis/library/sheets.googleapis.com
- Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com
- Google Picker API: https://console.cloud.google.com/apis/library/picker.googleapis.com

Проверка: на странице https://console.cloud.google.com/apis/dashboard в списке
**Enabled APIs & services** есть все три.

## 3. Настроить экран согласия OAuth

Экран согласия настраивается в разделе **Google Auth Platform**.

### 3.1. Первичная настройка

1. Откройте https://console.cloud.google.com/auth/overview и нажмите **Get started**.
2. **App Information**: **App name** — `DevNotes`, **User support email** — ваша почта,
   **Next**.
3. **Audience**: выберите **External**, **Next**.
4. **Contact Information**: ваша почта, **Next**.
5. **Finish**: отметьте согласие с User Data Policy, нажмите **Continue**, затем
   **Create**.

### 3.2. Branding

Откройте https://console.cloud.google.com/auth/branding.

- **App logo** не загружайте. С логотипом Google требует проверку бренда, а без неё
  на экране согласия всё равно виден только домен сайта.
- **Authorized domains**: **Add domain** → `<логин>.github.io`. Домен `github.io` общий
  для всех сайтов GitHub Pages, поэтому вводится домен вместе с вашим логином.
- **Application home page**: `https://<логин>.github.io/<репозиторий>/`.
- **Privacy policy** и **Terms of service**: справка Google называет их обязательными
  для внешних приложений в рабочем статусе. Если на шаге 4 кнопка **Publish app**
  неактивна из-за страницы Branding, укажите здесь ссылку на раздел «Данные и
  приватность» в README вашей копии, например
  `https://github.com/<логин>/<репозиторий>#данные-и-приватность`, и добавьте
  `github.com` в **Authorized domains**.
- Нажмите **Save**.

### 3.3. Data Access (области доступа)

1. Откройте https://console.cloud.google.com/auth/scopes.
2. Нажмите **Add or remove scopes**.
3. В фильтре введите `drive.file` и отметьте строку
   `https://www.googleapis.com/auth/drive.file` (Google Drive API). Если строки нет,
   проверьте, что Drive API включён (шаг 2), или впишите адрес области вручную в поле
   **Manually add scopes** внизу панели и нажмите **Add to table**.
4. Нажмите **Update**, затем **Save**.
5. Убедитесь, что `drive.file` попала в раздел **Your non-sensitive scopes**. Других
   областей не добавляйте: ни `drive`, ни `spreadsheets` приложению не нужны.

## 4. Перевести приложение в статус In production

В статусе Testing войти могут только вручную добавленные тестовые пользователи (не
больше 100), а выданный им доступ истекает через 7 дней.

1. Откройте https://console.cloud.google.com/auth/audience.
2. В блоке **Publishing status** нажмите **Publish app** и подтвердите (**Confirm**).
   Если кнопка неактивна, под ней написано, чего не хватает на странице Branding
   (см. шаг 3.2).
3. Статус должен смениться на **In production**.

Область `drive.file` относится к нечувствительным, поэтому полная проверка приложения
не нужна.

## 5. Узнать номер проекта

1. Откройте https://console.cloud.google.com/iam-admin/settings.
2. Скопируйте **Project number** (только цифры, не Project ID) — это
   `VITE_GOOGLE_APP_ID`. Picker требует, чтобы номер проекта и Client ID были из одного
   проекта.

## 6. Создать OAuth-клиент «Web application»

1. Откройте https://console.cloud.google.com/auth/clients и нажмите **Create client**.
2. **Application type**: **Web application**, **Name**: `DevNotes Web`.
3. **Authorized JavaScript origins** — нажмите **Add URI** три раза и введите:
   - `http://localhost:5173`
   - `http://localhost` (Google советует для локальной разработки указывать адрес и
     с портом, и без него)
   - `https://<логин>.github.io`

   Только схема и домен, без `/<репозиторий>/` и без слэша в конце, иначе консоль не
   примет адрес.

4. **Authorized redirect URIs** оставьте пустыми: сайт получает токен во всплывающем
   окне Google, переадресация не используется.
5. Нажмите **Create** и скопируйте **Client ID** — это `VITE_GOOGLE_CLIENT_ID`.

Новые адреса начинают работать не сразу: Google предупреждает, что это может занять
от 5 минут до нескольких часов.

## 7. Создать API-ключ для Picker

1. Откройте https://console.cloud.google.com/apis/credentials.
2. **Create credentials** → **API key**. Скопируйте ключ — это `VITE_GOOGLE_API_KEY`.
3. Откройте новый ключ в списке **API Keys**.
4. **Name**: `DevNotes Picker`.
5. **Application restrictions**: **Websites**. В **Website restrictions** добавьте:
   - `http://localhost:5173/*`
   - `https://<логин>.github.io/*`
   - `https://docs.google.com/*` — Picker открывается во фрейме с этого адреса; без
     него Picker выдаёт ошибку `API developer key is invalid`.
6. **API restrictions**: **Restrict key**, отметьте **Google Picker API** и **Google
   Drive API** (так советует документация Picker).
7. Нажмите **Save**.

## 8. Записать значения

### Для локальной разработки

Скопируйте `apps/web/.env.example` в `apps/web/.env.local` и заполните:

```dotenv
VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
VITE_GOOGLE_API_KEY=...
VITE_GOOGLE_APP_ID=...
```

Имя файла — ровно `.env.local`: файлы с другими именами, например `.env.local.example`,
Vite не читает. Файл в `.gitignore` и в репозиторий не попадёт. После правки
перезапустите `npm run dev`: Vite читает файл только при запуске.

### Для сайта на GitHub Pages

1. Откройте `https://github.com/<логин>/<репозиторий>/settings/variables/actions`
   (Settings → Secrets and variables → Actions → вкладка **Variables**).
2. **New repository variable** три раза, с теми же именами и значениями:
   `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID`.
3. Перезапустите публикацию (шаг 0.3), чтобы сайт собрался с ключами.

Именно **Variables**, а не Secrets: значения всё равно окажутся в коде сайта.

## 9. Проверка

- [ ] Сайт открывается по адресу `https://<логин>.github.io/<репозиторий>/` и
      показывает кнопку «Войти через Google».
- [ ] Вход проходит, на Диске появляется папка «DevNotes» с таблицей «DevNotes».
- [ ] `npm run dev` с `.env.local` — то же самое на `http://localhost:5173`.
- [ ] «Подключить общий проект» открывает Google Picker.

## MCP-сервер для Claude Code (по желанию)

Ему нужен ещё один OAuth-клиент, типа «Desktop app», в этом же проекте Google Cloud.
Заведите его Client ID и secret как переменные репозитория `DEVNOTES_MCP_CLIENT_ID` и
`DEVNOTES_MCP_CLIENT_SECRET` — тогда на сайте появится страница «Подключить Claude Code»
с командой для любого пользователя. Подробно — в [MCP.md](MCP.md).

## Если что-то не работает

| Что видно                                                               | Что проверить                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Сайт предлагает только демо-режим                                       | Переменные `VITE_GOOGLE_*` заведены (шаг 8), публикация перезапущена после этого          |
| `Error 400: origin_mismatch` при входе                                  | Адрес в шаге 6 точно совпадает с адресом в браузере; подождите до пары часов после правки |
| `Access blocked: ... has not completed the Google verification process` | Статус в шаге 4 — In production, а не Testing                                             |
| Окно Google не открывается                                              | Браузер блокирует всплывающие окна для сайта: разрешите их                                |
| `API developer key is invalid` в Picker                                 | `https://docs.google.com/*` и адрес сайта в ограничениях ключа (шаг 7)                    |
| Picker не видит файл или пишет о доступе                                | `VITE_GOOGLE_APP_ID` — это Project number того же проекта                                 |

## Источники

- [Получение Client ID для Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
- [Токен-модель Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Области доступа Google Drive API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Picker для веб-приложений](https://developers.google.com/workspace/drive/picker/guides/sample)
- [Статусы публикации OAuth-приложения](https://support.google.com/cloud/answer/15549945?hl=en)
- [Настройка Branding и Authorized domains](https://support.google.com/cloud/answer/15549049)
