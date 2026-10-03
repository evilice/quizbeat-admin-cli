# CLAUDE.md

Служебный контекст для агента, подхватывается автоматически в начале каждой
сессии в этом репозитории. Не дублирует `documentation/` целиком — только то,
что иначе агенту пришлось бы каждый раз заново выяснять чтением файлов.
Если что-то здесь разошлось с фактическим состоянием репозитория — доверять
коду и документации, а не этому файлу, и поправить его тем же PR.

## Что это за проект

Веб-клиент админки QuizBeat (Vite, React, TypeScript, MobX, MUI). Ходит в
staff-API соседнего репозитория `quizbeat-srv`. Игровой клиент и
player-контур не входят. Имя папки `quizbeat-admin-cli` — не тип приложения.

Роли, сценарии, стек —
[documentation/01-project-overview.md](./documentation/01-project-overview.md).
Карта staff-API —
[documentation/02-staff-api.md](./documentation/02-staff-api.md).
Этапы и принятые решения —
[documentation/03-technical-specification.md](./documentation/03-technical-specification.md).
Нумерация документов и этапов — этого репозитория, не `quizbeat-srv`.
Сессия — этап 1, сотрудники — этап 2, контент с тегов на этапе 3.
Поля запросов сверять с картой и с кодом `quizbeat-srv`; если они
разошлись, верен код сервера, карта правится здесь.

## Стек

- Vite + React + TypeScript. Dev-сервер на порту **5173** (так настроен
  `CORS_ORIGIN_ADMIN` бэкенда).
- MobX, MUI (`ruRU`), react-router.
- Vitest, oxlint, Prettier.
- `VITE_API_BASE_URL`, дефолт `http://localhost:3000`.

Каркас, HTTP-клиент и оболочка этапа 0 заведены. Команды:

| Что        | Команда          |
| ---------- | ---------------- |
| dev-сервер | `npm run dev`    |
| тесты      | `npm run test`   |
| линт       | `npm run lint`   |
| формат     | `npm run format` |
| сборка     | `npm run build`  |

## Раскладка `src`

Файлы группируются по домену. Общее — в `shared`, оболочка — в `app`.
Стор лежит рядом со своим экраном. Корневой стор — общий, он в `shared`.
Аудио, картинки и заметки — вложенные каталоги модуля композиций, не
отдельные модули верхнего уровня. Экран, в котором разметка смешана со
сценариями, режется папками внутри модуля. Правила разреза — раздел 11
в [documentation/04-development-rules.md](./documentation/04-development-rules.md).

```text
src/
  main.tsx
  app/                 # провайдеры, тема, роутер, шапка
  shared/
    api/               # один HTTP-клиент и разбор ошибки
    ui/                # ErrorMessages, пагинация списка, скрытый file input
    hooks/             # хуки без привязки к домену (дебаунс, последнее значение)
    store/             # RootStore и useRootStore
    testing/           # makeAccessToken, только тесты
  modules/
    session/
    admins/
    tags/
    compositions/
      audio/
      images/
      notes/
```

Экраны берут стор через `useRootStore` из `shared/store/root-store-context.tsx`
и не импортируют класс `RootStore`: контекст зависит от него только типом,
иначе цикл `shared/store` → модуль → `shared/store`. Типы отрезка, картинки
и заметки живут во вложенном модуле; `CompositionFull` собирает их через
`import type`. Исторические задачи этапов 0–8 описывают пути на момент
выполнения и не совпадают с этой раскладкой.

## Документация — куда смотреть

- [documentation/01-project-overview.md](./documentation/01-project-overview.md)
- [documentation/02-staff-api.md](./documentation/02-staff-api.md) —
  сверяться заново, не полагаться на память из прошлой сессии.
- [documentation/03-technical-specification.md](./documentation/03-technical-specification.md) —
  порядок поставки экранов. Сверяться заново.
- [documentation/04-development-rules.md](./documentation/04-development-rules.md) —
  обязательные правила (кратко — ниже).
- [documentation/tasks/status.md](./documentation/tasks/status.md) —
  какие этапы и задачи выполнены. Сверяться заново.
- [documentation/tasks/task-writing-guidelines.md](./documentation/tasks/task-writing-guidelines.md) —
  формат задач. Декомпозиция этапов 0–8 —
  [этап 0](./documentation/tasks/step-0/README.md),
  [этап 1](./documentation/tasks/step-1/README.md),
  [этап 2](./documentation/tasks/step-2/README.md),
  [этап 3](./documentation/tasks/step-3/README.md),
  [этап 4](./documentation/tasks/step-4/README.md),
  [этап 5](./documentation/tasks/step-5/README.md),
  [этап 6](./documentation/tasks/step-6/README.md),
  [этап 7](./documentation/tasks/step-7/README.md),
  [этап 8](./documentation/tasks/step-8/README.md).

## Правила разработки (кратко; полный текст —
в [documentation/04-development-rules.md](./documentation/04-development-rules.md))

1. Разведка перед реализацией — искать готовый паттерн в клиенте и
   фактический контракт в `quizbeat-srv`.
2. Один HTTP-клиент, один разбор ошибки, доменные сторы MobX, UI на MUI.
   Состояние экрана в доменный стор не переносится (раздел 11 правил).
   Скрытие по роли не заменяет `403` сервера.
3. TDD для сессии, ролей и разбора ошибок. Падающий тест чинится кодом, не
   ослаблением теста.
4. Не доверять API библиотек и форме запросов сервера по памяти.
5. Не копипастить — выносить общее на втором использовании.
6. Не выходить за границы задачи.
7. Ревью двухуровневое: `/code-review` в отдельном контексте обязателен;
   человек обязателен для сессии и токенов, развилки ролей, загрузки файлов
   и любого `dangerouslySetInnerHTML`. Уровень усилия указывается явно.
8. `npm run lint` и `npm run test` после каждого изменения; `npm run build`
   перед сдачей задачи, которая трогает сборку, маршрут или стор.
9. Обзор, карта API и ТЗ правятся в том же PR, что и код. Контракт сервера
   отсюда не переписывается: расхождение чинится в карте клиента.
10. Коммиты с префиксом (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`),
    текст после префикса — на русском.

## Специфика, которую не выведешь за одно чтение ТЗ

- Access staff-JWT: `sub`, `role`, `type: 'staff'`. Email в токене нет,
  `GET /admins/me` на сервере нет.
- Refresh ротируется. Повтор уже использованного refresh не работает.
  Параллельные `401` должны делить один refresh.
- `fileUrl` отрезка нет в JSON, пока статус не `DONE` (поле отсутствует, это
  не `null`). Presigned-ссылки протухают (дефолт сервера — 3600 с).
- Аудио — multipart-поле `file`. Картинки — поле `files`, не больше 10.
- `tagIds` в списке композиций — одна строка через запятую, семантика OR.
  `isActive` в списке сотрудников — строки `true`/`false`.
- `tagIds` у композиции, `imageIds` и `noteIds` порядка — полная замена
  набора, не diff.
- Удаление композиции мягкое, тега — жёсткое, отрезка и картинки и заметки —
  жёсткое, сотрудника — деактивация (`isActive: false`) с отзывом refresh.
  Вернуть композицию нельзя. Сотрудника можно активировать снова через
  `PATCH`.
- Деактивация не обрывает уже выданный access до конца его TTL (около 15
  минут). Успешная смена своего пароля тоже отзывает refresh и не выдаёт
  новую пару; неверный текущий пароль — отдельный `401`
  (`Current password is incorrect`), не отказ access-токена.
- Документация и коммиты — на русском, идентификаторы в коде — на
  английском.
