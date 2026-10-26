# Kezek — веб-платформа электронной очереди

**Для инвестора:** [сценарий демонстрации и доступ без VPS](docs/INVESTOR-DEMO.md). Репозиторий содержит исходники и инструкции; внешняя работающая демонстрация настраивается отдельно.

Два независимых приложения с отдельными PostgreSQL-базами:

Runtime 1.1.0 работает **по назначенным сотруднику услугам и подуслугам, без столов**. Назначения, миграция и протокол Runtime v2 описаны в [EMPLOYEE-SERVICES.md](docs/EMPLOYEE-SERVICES.md). Control Plane сохраняет протокол v1.

- **Control Plane** (`apps/control-api`, порт 3002): закрытая панель владельца, компании/филиалы/установки, регистрационные токены, подписанные команды, последнее известное состояние и релизы.
- **Runtime** (`apps/runtime-api`, порт 3001): `/terminal`, `/display`, `/staff`, `/admin`, `/setup`. Работает без Control Plane, GitHub и интернета при доступной локальной базе.
- `apps/web`: два самостоятельных production build — `dist-control` и `dist-runtime`, общие компоненты и словари RU/KK/EN. APK/EXE/Electron не создавались.

## Локальная демонстрация

Нужны Node.js 22+, npm, PostgreSQL 16+ и четыре пустые UTF8-базы (две рабочие и две тестовые с суффиксом `_test`).

```sh
cp .env.example .env
# Настроить RUNTIME_DATABASE_URL и CONTROL_DATABASE_URL, ключи и секрет установщика.
npm ci
npm run build
npm run migrate
npm run bootstrap
```

`bootstrap` создаёт две компании, три филиала, разные роли и индивидуальные временные пароли. Повторный запуск сохраняет данные и пароли. Учётные данные записываются в **`.local/demo-credentials.json`** и не выводятся в журнал. Не публикуйте этот файл. Первый вход сотрудника/администратора требует смены пароля. Демонстрационные токены — в этом же файле.

Запуск из двух терминалов:

```sh
node --env-file=.env apps/runtime-api/dist/index.js
node --env-file=.env apps/control-api/dist/index.js
```

Открыть [Control Plane](http://localhost:3002/owner), [админку компании](http://localhost:3001/admin), [сотрудника](http://localhost:3001/staff), [терминал](http://localhost:3001/terminal), [телевизор](http://localhost:3001/display). Polling включён по умолчанию. После переключения на `Auto` используются WebSocket и автоматический HTTP fallback.

В текущей рабочей среде подготовлена изолированная локальная демонстрация и отдельный тестовый PostgreSQL на `127.0.0.1:55433`. Старые базы прежнего проекта не используются. `.tools` — временные средства проверки, не часть переносимой поставки. Подробности запуска после перезагрузки — [LOCAL.md](docs/LOCAL.md).

## Установка заказчику

1. [Полная инструкция от установки до диагностики](docs/INSTALLATION.md).
2. [Архитектура, API, независимость приложений и область доступа](docs/ARCHITECTURE.md).
3. [Импорт сотрудников и индивидуальные пароли](docs/IMPORT.md).
4. [Отчёты, формулы и часовой пояс](docs/REPORTS.md).
5. [Приватный GitHub, подписанные обновления, backup/restore](docs/UPDATES.md).
6. [Передача данных, изоляция и удалённые команды](docs/PRIVACY.md).
7. [Проверки, ограничения и оставшиеся задачи](docs/STATUS.md).
8. [Услуги и вложенные подуслуги](docs/SERVICES.md).

Полная инструкция: [PDF от А до Я](output/pdf/Kezek_Manual_A-Z_RU.pdf). Структура **компания → филиалы → точки обслуживания** описана в [BRANCHES-POINTS.md](docs/BRANCHES-POINTS.md). Филиалы создаются в «Организация → Филиалы», их точки — в «Точки обслуживания». У каждой точки своя очередь и устройства.

Для production используйте отдельные окружения `.env.runtime` и `.env.control`. Runtime не должен получать приватный ключ Control Plane. Для Docker скопируйте `.env.runtime.example`, `.env.control.example`, `.env.compose.example`, задайте секреты и публичные/приватные ключи, затем `docker compose --env-file .env.compose up -d --build`. Внешнее размещение требует HTTPS/WSS.

## Проверки

```sh
npm test
npm run check
npm run test:ui
npm run test:services
npm run test:company-branches
npm run test:owner-access
npm run test:restart
```

Серверные тесты автоматически применяют миграции к отдельным `_test`-базам в новой схеме для каждого запуска. Рабочие данные не удаляются. Браузерная проверка использует локальную демонстрацию, создаёт тестовых сотрудников и обновляет их временные пароли в закрытом локальном файле. См. STATUS.md для фактически выполненных проверок.
