# Настройка Google для DevNotes

Эту настройку владелец делает один раз, до этапа 2. Нужен аккаунт Google и доступ
к настройкам репозитория `invex0811/devNotes` на GitHub. Займёт около 20 минут.

Шаги сверены с документацией Google на 19 ноября 2026 года. Google иногда
переименовывает кнопки в консоли; если что-то выглядит иначе, ищите по смыслу или
напишите мне.

В итоге у вас будут три значения:

| Переменная              | Что это                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID` | Client ID веб-клиента OAuth, заканчивается на `.apps.googleusercontent.com` |
| `VITE_GOOGLE_API_KEY`   | API-ключ для Google Picker                                                  |
| `VITE_GOOGLE_APP_ID`    | Номер проекта Google Cloud (Project number), только цифры                   |

Все три значения попадут в код сайта, который видит любой посетитель. Так и задумано:
это не секреты, а защищают их ограничения по адресам из шагов 5 и 6. **Client secret
сайту не нужен**, никуда его не копируйте.

Адреса, которые понадобятся:

- Сайт на GitHub Pages: `https://invex0811.github.io/devNotes/`
- Его origin (схема и домен без пути): `https://invex0811.github.io`
- Локальная разработка: `http://localhost:5173`

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

Экран согласия теперь настраивается в разделе **Google Auth Platform**.

### 3.1. Первичная настройка

1. Откройте https://console.cloud.google.com/auth/overview и нажмите **Get started**.
2. **App Information**:
   - **App name**: `DevNotes`.
   - **User support email**: ваша почта.
   - **Next**.
3. **Audience**: выберите **External**. **Next**.
4. **Contact Information**: ваша почта. **Next**.
5. **Finish**: отметьте согласие с User Data Policy, нажмите **Continue**, затем
   **Create**.

### 3.2. Branding

Откройте https://console.cloud.google.com/auth/branding.

- **App logo** не загружайте. С логотипом Google требует проверку бренда, а без неё
  на экране согласия всё равно будет виден только домен сайта.
- **Authorized domains**: нажмите **Add domain** и введите `invex0811.github.io`.
  Домен `github.io` общий для всех сайтов GitHub Pages, поэтому вводится домен вместе
  с вашим именем пользователя.
- **Application home page**: `https://invex0811.github.io/devNotes/` (необязательно).
- **Privacy policy** и **Terms of service** оставьте пустыми. Справка Google называет
  их обязательными для внешних приложений в рабочем статусе. Если на шаге 4 консоль не
  даст опубликовать приложение без них, напишите мне: я добавлю на сайт простую
  страницу с политикой. В ТЗ её нет, поэтому без вашего согласия я её не делаю.
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
3. Статус должен смениться на **In production**.

Область `drive.file` относится к нечувствительным, поэтому полная проверка приложения
не нужна. Если консоль всё-таки покажет, что нужна проверка (Verification Center),
не отправляйте ничего и напишите мне, что именно она просит.

## 5. Создать OAuth-клиент «Web application»

1. Откройте https://console.cloud.google.com/auth/clients и нажмите **Create client**.
2. **Application type**: **Web application**.
3. **Name**: `DevNotes Web`.
4. **Authorized JavaScript origins** — нажмите **Add URI** три раза и введите:
   - `http://localhost:5173`
   - `http://localhost` (Google советует для локальной разработки указывать адрес и
     с портом, и без него)
   - `https://invex0811.github.io`

   Только схема и домен, без `/devNotes/` и без слэша в конце, иначе консоль не примет
   адрес.

5. **Authorized redirect URIs** оставьте пустыми: сайт получает токен во всплывающем
   окне Google, переадресация не используется.
6. Нажмите **Create**. В окне с результатом скопируйте **Client ID** — это
   `VITE_GOOGLE_CLIENT_ID`. Client secret не нужен.

Новые адреса начинают работать не сразу: Google предупреждает, что это может занять
от 5 минут до нескольких часов.

## 6. Создать API-ключ для Picker

1. Откройте https://console.cloud.google.com/apis/credentials.
2. **Create credentials** → **API key**. Скопируйте ключ — это `VITE_GOOGLE_API_KEY`.
   Если консоль сразу предложит ограничить ключ, переходите к пункту 4 в этом окне.
3. В списке **API Keys** нажмите на новый ключ.
4. **Name**: `DevNotes Picker`.
5. **Application restrictions**: **Websites**. В **Website restrictions** добавьте:
   - `http://localhost:5173/*`
   - `https://invex0811.github.io/*`
   - `https://docs.google.com/*` — Picker открывается во фрейме с этого адреса; без
     него Picker выдаёт ошибку `API developer key is invalid`.
6. **API restrictions**: **Restrict key**, отметьте **Google Picker API** и **Google
   Drive API**. Документация Picker советует разрешить оба, хотя в ТЗ упомянут только
   Picker.
7. Нажмите **Save**.

## 7. Узнать номер проекта

1. Откройте https://console.cloud.google.com/iam-admin/settings.
2. Скопируйте **Project number** (только цифры, не Project ID) — это
   `VITE_GOOGLE_APP_ID`. Picker требует, чтобы номер проекта и Client ID были из одного
   проекта.

## 8. Записать значения

### Локально

Создайте файл `apps/web/.env.local` (рядом с `apps/web/package.json`; образец —
`apps/web/.env.example`):

```dotenv
VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
VITE_GOOGLE_API_KEY=...
VITE_GOOGLE_APP_ID=...
```

Имя файла — ровно `.env.local`: файлы с другими именами, например `.env.local.example`,
Vite не читает. Файл уже в `.gitignore` и в репозиторий не попадёт. После правки перезапустите
`npm run dev`: Vite читает файл только при запуске.

### В GitHub

1. Откройте https://github.com/invex0811/devNotes/settings/variables/actions
   (Settings → Secrets and variables → Actions → вкладка **Variables**).
2. **New repository variable** три раза, с теми же именами и значениями:
   `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID`.

Именно **Variables**, а не Secrets: значения всё равно окажутся в коде сайта. Сборка
в CI начнёт их использовать после этапа 2.

## 9. GitHub Pages

Уже включено на этапе 0: Settings → Pages → Source: **GitHub Actions**. Сайт
публикуется по адресу https://invex0811.github.io/devNotes/. Ничего делать не нужно.

## Позже: OAuth-клиент «Desktop app» для MCP-сервера

Понадобится перед этапом 6, сейчас этот шаг можно пропустить.

1. https://console.cloud.google.com/auth/clients → **Create client**.
2. **Application type**: **Desktop app**, **Name**: `DevNotes MCP`.
3. **Create**. Client ID и Client secret этого клиента не кладите ни в `.env.local`
   сайта, ни в GitHub; куда их положить, будет написано в `docs/MCP.md`.

## Проверка перед этапом 2

- [ ] В проекте `DevNotes` включены Sheets, Drive и Picker API.
- [ ] Экран согласия: External, область только `drive.file`, статус **In production**.
- [ ] Веб-клиент с тремя JavaScript origins, без redirect URIs.
- [ ] API-ключ ограничен сайтами (включая `docs.google.com`) и API Picker и Drive.
- [ ] `apps/web/.env.local` заполнен тремя значениями.
- [ ] Три переменные заведены в GitHub.

Когда всё готово, напишите в чат «Google настроен». Сами значения присылать не нужно.

## Если что-то не работает

| Что видно                                                               | Что проверить                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Error 400: origin_mismatch` при входе                                  | Адрес в шаге 5 точно совпадает с адресом в браузере; подождите до пары часов после правки |
| `Access blocked: ... has not completed the Google verification process` | Статус в шаге 4 — In production, а не Testing                                             |
| `API developer key is invalid` в Picker                                 | `https://docs.google.com/*` в ограничениях ключа (шаг 6)                                  |
| `The API developer key is invalid` или 403 на локальном сайте           | Адрес `http://localhost:5173/*` в ограничениях ключа                                      |
| Picker не видит файл или пишет о доступе                                | `VITE_GOOGLE_APP_ID` — это Project number того же проекта                                 |

## Источники

- [Получение Client ID для Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
- [Токен-модель Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Области доступа Google Drive API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Picker для веб-приложений](https://developers.google.com/workspace/drive/picker/guides/sample)
- [Статусы публикации OAuth-приложения](https://support.google.com/cloud/answer/15549945?hl=en)
- [Настройка Branding и Authorized domains](https://support.google.com/cloud/answer/15549049)
