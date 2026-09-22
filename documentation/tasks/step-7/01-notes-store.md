# Задача 1 — Стор заметок композиции

Этап: 7 — Заметки «А знали ли Вы?».
Зависимости: [HTTP-клиент](../step-0/02-http-client.md) (JSON,
пустой `204` → `undefined`, разбор `message`). Access и `401` — уже
через [перехватчик](../step-1/02-refresh-on-401.md). Стор композиций и
корневой стор —
[задача 1 этапа 4](../step-4/01-compositions-store.md) /
[`src/stores/root-store.ts`](../step-0/03-app-shell.md).
Ссылка на ТЗ: [раздел «Этап 7»](../../03-technical-specification.md#этап-7--заметки-а-знали-ли-вы).
Карта: [заметки](../../02-staff-api.md#8-заметки).
Контроллер —
[`notes.controller.ts`](../../../../quizbeat-srv/src/notes/notes.controller.ts).
Сервис —
[`notes.service.ts`](../../../../quizbeat-srv/src/notes/notes.service.ts).
DTO —
[`CreateNoteDto`](../../../../quizbeat-srv/src/notes/dto/create-note.dto.ts),
[`UpdateNoteDto`](../../../../quizbeat-srv/src/notes/dto/update-note.dto.ts),
[`NoteTranslationDto`](../../../../quizbeat-srv/src/notes/dto/note-translation.dto.ts),
[`ReorderNotesDto`](../../../../quizbeat-srv/src/notes/dto/reorder-notes.dto.ts),
[`NoteResponseDto`](../../../../quizbeat-srv/src/notes/dto/note-response.dto.ts).
Сообщения —
[`notes/constants.ts`](../../../../quizbeat-srv/src/notes/constants.ts),
полнота локалей —
[`assert-complete-translations.ts`](../../../../quizbeat-srv/src/common/assert-complete-translations.ts).
Поля, уже перечисленные в карте, здесь не повторяются.

## Зачем

Список, форма, порядок и удаление должны ходить через один модуль.
Поле перевода у заметки — `text`, у тега — `name`; массив из двух
локалей легко отправить объектом или одним элементом. Путь порядка —
литеральный `order`: подставить uuid или слово `order` как `:noteId`
сломает маршрут. `DELETE` отвечает пустым `204`. Экран в эту задачу
не входит: сеть проверяется моком `fetch`.

## Границы задачи

| Входит | Не входит |
|---|---|
| Методы стора: `GET` / `POST` `.../notes`, `PATCH .../notes/:noteId`, `PATCH .../notes/order`, `DELETE .../notes/:noteId` | Блок списка на карточке — [задача 2](./02-notes-list.md) |
| Тесты на моке: `translations` с `text` (не `name`), оба перевода в `PATCH`, полный `noteIds`, пустой не уходит, путь с сегментом `order`, `204` удаления → успех | Форма UI — [задача 3](./03-note-form.md). Стор отправляет тот набор, который ему передали |
| | Смена порядка в UI — [задача 4](./04-notes-reorder.md); удаление в UI — [задача 5](./05-notes-delete.md) |
| | `GET /compositions/:id/full` — принадлежит стору композиций, [задача 1 этапа 4](../step-4/01-compositions-store.md). Картинки, аудио — [этап 6](../../03-technical-specification.md#этап-6--изображения-композиции) / [этап 5](../../03-technical-specification.md#этап-5--аудио-и-отрезки) |

## ⚠ Технические нюансы и ограничения

- `translations` — массив ровно из двух элементов, у каждого `locale`
  (`ru` или `en`) и **`text`**. Объект вида `{ ru: '...', en: '...' }`
  и поле `name` сервер не примет. Дубль одной локали при двух
  элементах проходит `@ArrayMinSize(2)` и падает в сервисе с `400` и
  `message`
  `Translations must include exactly one entry per locale (ru, en), without duplicates`
  ([`assertCompleteTranslations`](../../../../quizbeat-srv/src/common/assert-complete-translations.ts)).
- `PATCH .../notes/:noteId`, в котором передан `translations`, заменяет
  набор целиком
  ([`NotesService.update`](../../../../quizbeat-srv/src/notes/notes.service.ts)).
  Метод стора кладёт в тело оба элемента, которые получил. Схлопнуть
  до одной локали нельзя.
- Порядок — JSON `{ noteIds: string[] }`, полный текущий набор, хотя
  бы один id. Пустой массив метод не шлёт (`@ArrayMinSize(1)`).
  Несовпадение набора — `400` с текстом из
  `NOTE_ID_SET_MISMATCH_MESSAGE`. Ответ — массив с обновлённым `order`
  (индекс с 0).
- Путь порядка — `PATCH /compositions/:id/notes/order` (литерал
  `order`). На сервере этот хендлер зарегистрирован **раньше**
  `PATCH :noteId` — иначе `order` поймал бы `ParseUUIDPipe`. Клиент не
  подставляет uuid на месте `order` и не шлёт тело порядка на
  `.../notes/:noteId`. См.
  [README](./README.md#решения-по-открытым-вопросам-этапа).
- Удаление — `204` без тела → клиент отдаёт `undefined`, метод стора
  считает это успехом и не парсит JSON повторно. Жёсткое удаление, не
  `200` с `deletedAt`. Отдельного `GET .../notes/:noteId` нет, метод
  его не заводит.
- Список — `200` массив без пагинации, в порядке `order`. Создание —
  `201` одна заметка. Multipart и HTTP-клиент этот этап не расширяет:
  только JSON.
- Методы кладутся рядом со стором композиций / картинок или в
  отдельный стор того же `root-store` — см. README. Второго
  HTTP-клиента нет. Файл перехватчика `401` эта задача не меняет.

## Объём работы

- Методы стора через клиент этапа 0:
  - список: `GET /compositions/:id/notes` → массив;
  - создание: `POST /compositions/:id/notes`, тело `{ translations }`,
    успех `201` → заметка;
  - правка: `PATCH /compositions/:id/notes/:noteId`, тело с переданными
    `translations`, успех `200` → заметка;
  - порядок: `PATCH /compositions/:id/notes/order`, тело `{ noteIds }`,
    успех `200` → массив;
  - удаление: `DELETE /compositions/:id/notes/:noteId`, успех `204`.
- Тесты на моке `fetch`, без экрана:
  - `POST` отправляет `translations` массивом из двух элементов с
    полями `locale` и `text`; в JSON нет поля `name` и нет объекта,
    ключи которого — локали;
  - `PATCH` заметки (путь с uuid) шлёт оба переданных перевода, а не
    один;
  - порядок шлёт JSON с ключом `noteIds` — полный переданный набор;
    URL содержит сегмент `/order` (не uuid на месте `order`); вызов с
    `[]` сеть не трогает;
  - `DELETE` с `204` и пустым телом завершается успехом (`undefined`),
    без исключения парсера;
  - `400` / `404` пробрасываются с `message` сервера, ключ refresh в
    переданном хранилище остаётся.

## Критерии готовности

- Тесты из объёма работы проходят через `npm run test`.
- `npm run lint` проходит. `npm run build` проходит, если задача
  трогала публичные типы или корневой стор.
- В модуле стора есть пути `.../notes` и `.../notes/order`, нет пути
  `/compositions/:id/full` и нет отдельного чтения одной заметки.
  Проверяется чтением модуля.
