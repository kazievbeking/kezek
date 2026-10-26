# Подписанные обновления и восстановление

Runtime 1.1.0 работает без столов и использует protocol=2. Новые release manifests требуют protocol=2; изменение модели и сохранность истории описаны в EMPLOYEE-SERVICES.md. Старые примеры protocol=1 ниже относятся к предыдущей версии. Переход с updater v1 на v2 требует отдельного проверенного плана внедрения; не обещать автоматическую совместимость старого updater с новым manifest.

## Граница готовности

В проекте есть отдельный `scripts/updater.ts`, очередь UpdateJob, закрытая загрузка пакета в админке, подписи Ed25519, проверка SHA-256/протокола/совместимости, расписание, блокировка процесса, проверка активных клиентов/печати и этапы backup → migration → switch → health. Реальный приватный GitHub, production service scripts, установка релиза и аварийное восстановление на внешнем сервере **ещё не настроены и не проверены**. По умолчанию `MAINTENANCE_ENABLED=false`; это сохраняет очередь работающей до подготовки установщиком.

## Канал GitHub

Выделить приватный репозиторий релизов. Runtime нужен fine-grained token только с чтением **Contents** выбранного репозитория. Не давать ему write/admin, ключ подписи или ваш основной GitHub token. Значения `GITHUB_REPOSITORY=organisation/repository`, `GITHUB_READ_TOKEN` и `UPDATE_PUBLIC_KEY_FILE` находятся только на сервере updater, не в browser build. API получения release asset использует `Accept: application/octet-stream`; GitHub может вернуть файл или redirect. См. [GitHub release assets](https://docs.github.com/en/rest/releases/assets) и [releases](https://docs.github.com/en/rest/releases/releases).

Updater получает latest release напрямую из GitHub; Control Plane не является обязательным посредником. Release содержит `kezek-manifest.json` и `kezek-runtime-X.Y.Z.tar.gz`. Подписывается manifest с `kind=release`, version, protocol=1, fromVersions, sha256, assetId, fileName. Отдельный release private key хранится на машине выпуска. В Control Plane можно сохранить этот же подписанный manifest для каталога релизов; каталог не заменяет проверку на Runtime.

## Подготовка пакета

Собирать на совместимой с заказчиком Linux/архитектуре: Argon2 и Prisma содержат native-модули. Windows node_modules нельзя передавать Linux-серверу. В чистом checkout выполнить `npm ci`, `npm run build`, проверки. Пакет должен содержать готовые зависимости, Runtime build, UI, миграции, generated client и updater. Пример GNU tar из корня подготовленной сборки:

```sh
tar --dereference --hard-dereference -czf /tmp/kezek-runtime-1.1.0.tar.gz \
  package.json package-lock.json tsconfig.json node_modules \
  apps/runtime-api/package.json apps/runtime-api/dist apps/web/dist-runtime \
  packages/shared db/runtime generated/runtime \
  scripts/updater.ts scripts/backup.ts
```

Никаких `.env`, `.local`, `.tools`, секретов, тестовых БД и backup. Tar не должен содержать абсолютных путей, `..`, symlinks или hardlinks: updater отклоняет их. Пакет не содержит Node.js — совместимую версию предоставляет сервер. При росте пакета учитывать ограничения: online download до 500 МБ, ручная загрузка до 300 МБ.

Загрузить tar.gz как asset в подготовленный release, получить его числовой asset ID, затем на машине подписи:

```sh
RELEASE_PRIVATE_KEY_FILE=/secure/release-private.pem \
node --import tsx scripts/sign-release.ts 1.1.0 /tmp/kezek-runtime-1.1.0.tar.gz ASSET_ID > /tmp/kezek-manifest.json
```

Пример version не означает выпущенный релиз. Перед выпуском изменить VERSION, версии пакетов и health/client-version; проверить диапазон fromVersions (скрипт по умолчанию `^1.0.0`) и protocol. Загрузить manifest, затем опубликовать release. SHA относится к точным байтам архива. После изменения архива подписать заново. Ротация публичных ключей требует отдельной доверенной процедуры.

## Отдельный процесс и сервисы

```sh
node --env-file=.env.runtime --import tsx scripts/updater.ts
```

Процесс должен запускаться systemd/другим supervisor независимо от Runtime API и переживать его остановку. В конфигурации:

- `UPDATE_DIRECTORY`: закрытый каталог релизов/backup, постоянный диск.
- `INSTALLATION_TIMEZONE`: начальный IANA timezone установки; после активации используется сохранённое значение Installation.timezone.
- `PG_DUMP_PATH`: путь к совместимому pg_dump; `RUNTIME_CONFIG_FILE`: абсолютный путь к реальной конфигурации для обязательной резервной копии.
- `UPDATE_CURRENT_LINK`: существующая Linux symlink на текущую папку релиза. Service запускает Node с WorkingDirectory по этой ссылке.
- `UPDATE_STOP_SCRIPT`, `UPDATE_START_SCRIPT`: абсолютные исполняемые скрипты остановки/старта только Runtime API, с ограниченными правами. Они обязаны дождаться результата. Updater и PostgreSQL продолжат работу.
- `UPDATE_HEALTH_URL`: доступный `/api/health`; проверяются HTTP status и целевая версия.
- `MAINTENANCE_ENABLED=true`: включать после репетиции в staging.
- `UPDATE_APP_ROLLBACK_SAFE=true`: только когда старое приложение совместимо с новой схемой. Не включать «на всякий случай».

Автоматическая смена файлов контейнера не является обновлением Docker image. Профиль Compose `updater` пригоден для проверки/скачивания; для применения в контейнерном окружении нужны отдельные service hooks и управление image/deployment. Docker socket в контейнер не монтируется. Текущая реализация атомарной смены symlink рассчитана на Linux; на Windows этот production-сценарий не проверен.

## Расписание и безопасный момент

Раз в день выбирается случайная секунда между 12:00 и 13:00 по timezone установки; выбор сохраняется на диск. После пропущенного окна следующая автоматическая проверка — на следующий день. Ручная кнопка запрашивает проверку сейчас, но установка всё равно ожидает окно. Только явный операторский `UPDATE_ALLOW_OUTSIDE_WINDOW=true` разрешает иной согласованный maintenance period.

Отдельное PostgreSQL-соединение держит process advisory lock: одновременно работает один updater. Перед установкой транзакция получает exclusive maintenance lock. Обычные команды используют shared lock: исключена гонка «проверили отсутствие клиента → появился новый клиент». Если есть CALLED/SERVING или незакрытый PrintLease, статус DEFERRED. Ожидающие талоны остаются в БД. Во время maintenance новые изменения отклоняются, polling показывает ошибку обслуживания и повторяет подключение; после запуска данные восстанавливаются из PostgreSQL.

PrintLease создаётся в одной транзакции с выдачей. Диалог браузера не подтверждает бумагу; аварийно оборванная печать намеренно блокирует обновление. Оператор сначала проверяет принтер/талон, затем может выполнить `scripts/clear-print-lease.ts TICKET_UUID`. Это аудируется. Не удалять lease вслепую по таймеру.

После backup БД и конфигурации updater останавливает API, запускает только новые миграции, меняет ссылку, запускает сервис, проверяет health и записывает APPLIED. Миграции должны сохранять данные и совместимость протокола v1 либо явно сопровождаться новой версией протокола. Браузер предлагает обновить страницу; перезагрузка запрещена при активном клиенте/неизвестном результате команды.

## Ручной пакет без интернета

В `/admin` → «Обновления» загрузить tar.gz и вставить JSON manifest, подписанный доверенным release key. API проверяет подпись, protocol и SHA, сохраняет пакет за пределами web-root и ставит OFFLINE_REQUESTED. Установку выполняет тот же отдельный updater с теми же блокировками/backup/окном. Для этого не требуются GitHub credentials или доступность Control Plane. Ручная загрузка не означает немедленного применения.

Статусы видны в Runtime; если bridge включён, в Control Plane передаются последние 10 сочетаний version/status/updatedAt, без manifest, путей, секретов или текста exception. Снимок обновляется примерно раз в 30 секунд. В isolated эти технические сведения не содержат персональных данных.

## Backup

```sh
node --env-file=.env.runtime --import tsx scripts/backup.ts runtime
node --env-file=.env.control --import tsx scripts/backup.ts control
```

Скрипт использует pg_dump custom format, пароль — через окружение дочернего процесса. Дополнительно сохранять конфигурацию, public keys и отдельно защищённую копию private keys только владельца. Шифровать backup вне сервера, проверять retention/место на диске и регулярно репетировать restore. Копирование работающей папки PostgreSQL не заменяет согласованную резервную копию.

## Восстановление и неудача миграции

Автоматический rollback приложения допустим только при заранее подтверждённой совместимости схемы. Схема не откатывается автоматически. Если миграция началась и безопасный rollback не разрешён, maintenance остаётся включённым: нужен оператор. Статус FAILED не равен успешному восстановлению.

1. Остановить Runtime API и updater, закрыть доступ к изменениям. Сохранить повреждённую БД и журнал для разбора; определить возможную потерю данных после backup.
2. Создать **новую** UTF8-базу восстановления с отдельным именем. Использовать pg_restore совместимой версии: `pg_restore --exit-on-error --no-owner -h HOST -U USER -d NEW_DATABASE runtime.dump`. Пароль передать безопасным механизмом PostgreSQL, не в командной строке.
3. На изолированном staging-сервере проверить миграции, количество талонов/пользователей, связи компании/филиала, вход, вызов/завершение, отчёты. Не применять `migrate reset` или destructive clean к рабочей БД.
4. Согласованно вернуть совместимую папку приложения и конфигурацию, переключить URL БД на проверенную копию. Только после проверки очистить maintenance через административный доступ к восстановленной БД.
5. Запустить API, проверить health и устройства; затем updater. Отдельно восстановить Control Plane при необходимости — Runtime от него не зависит.

Полный rehearsal выпуска/аварийного restore и нагрузочное испытание — обязательная часть внедрения конкретному заказчику, ещё не выполненная в этой среде.
