# QuizBeat — клиент админки

Веб-клиент админки музыкальной игры-угадайки QuizBeat. Сотрудники ведут
композиции, отрезки, теги, картинки и заметки через уже готовый API
[quizbeat-srv](../quizbeat-srv). Подробнее — в [документации](./documentation).

Каталог репозитория называется `quizbeat-admin-cli`. Это имя папки, не тип
приложения: клиент — сайт на React, не командная утилита.

## Документация

- [Обзор](./documentation/01-project-overview.md) — кто пользуется клиентом,
  какие сценарии он закрывает, как он связан с сервером.
- [Техническое задание по этапам](./documentation/03-technical-specification.md) —
  стек, общие требования, порядок поставки экранов, принятые по умолчанию
  решения.
- [Правила разработки](./documentation/04-development-rules.md) — обязательные
  практики для написания кода через вайб-кодинг. Адаптация правил бэкенда.
- [Оформление задач](./documentation/tasks/task-writing-guidelines.md) —
  как декомпозировать этап ТЗ на файлы в `documentation/tasks/step-N/`.

Модель данных и полевой контракт API живут в `quizbeat-srv`
([обзор](../quizbeat-srv/documentation/01-project-overview.md),
[модель](../quizbeat-srv/documentation/02-data-model.md),
[ТЗ бэкенда](../quizbeat-srv/documentation/03-technical-specification.md)).
Здесь они не дублируются.

Кода приложения ещё нет: этап 0 ТЗ — каркас Vite. Команды `npm run dev` /
`lint` / `test` появятся вместе с ним.

## Локальная связка с сервером

Сервер: `http://localhost:3000`. Клиент, когда каркас будет поднят:
`http://localhost:5173` — этот origin уже разрешён в `CORS_ORIGIN_ADMIN`
бэкенда.
