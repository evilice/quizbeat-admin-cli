# Задача 1 — Стор картинок композиции

Этап: 6 — Изображения композиции.
Зависимости: [HTTP-клиент](../step-0/02-http-client.md) (низкоуровневый
вызов без навязанного `Content-Type: application/json`, JSON-обёртка,
пустой успех → `undefined`, разбор `message`); multipart-путь этапа 5 —
[задача 1 этапа 5](../step-5/01-audio-clips-store.md) (поле `file`).
Access и `401` — уже через
[перехватчик](../step-1/02-refresh-on-401.md). Стор композиций и
корневой стор —
[задача 1 этапа 4](../step-4/01-compositions-store.md) /
[`src/stores/root-store.ts`](../step-0/03-app-shell.md).
Ссылка на ТЗ: [раздел «Этап 6»](../../03-technical-specification.md#этап-6--изображения-композиции).
Карта: [картинки](../../02-staff-api.md#7-картинки).
Контроллер —
[`composition-images.controller.ts`](../../../../quizbeat-srv/src/composition-images/composition-images.controller.ts).
Сервис —
[`composition-images.service.ts`](../../../../quizbeat-srv/src/composition-images/composition-images.service.ts).
DTO —
[`ReorderCompositionImagesDto`](../../../../quizbeat-srv/src/composition-images/dto/reorder-composition-images.dto.ts),
[`CompositionImageResponseDto`](../../../../quizbeat-srv/src/composition-images/dto/composition-image-response.dto.ts).
Сообщения —
[`composition-images/constants.ts`](../../../../quizbeat-srv/src/composition-images/constants.ts).
Лимит размера —
[`CompositionImagesModule`](../../../../quizbeat-srv/src/composition-images/composition-images.module.ts).
Типы —
[`allowed-file-types.ts`](../../../../quizbeat-srv/src/storage/allowed-file-types.ts).
Поля, уже перечисленные в карте, здесь не повторяются.

## Зачем

Загрузка, список, порядок и удаление должны ходить через один модуль.
Multipart с именем `file` вместо `files`, JSON-заголовок на `FormData`
или частичный `imageIds` отвалятся до осмысленного UI. `DELETE`
отвечает пустым `204`, а `fileUrl` у картинки есть сразу — без
зафиксированного контракта экран легко скопирует опрос отрезков или
примет успех удаления за сбой. Экран в эту задачу не входит: сеть
проверяется моком `fetch`.

## Границы задачи

| Входит | Не входит |
|---|---|
| Методы стора: `POST .../images`, `GET .../images`, `PATCH .../images/order`, `DELETE .../images/:imageId` | Блок загрузки и списка на карточке — [задача 2](./02-images-upload-and-list.md) |
| Обобщение того же HTTP-клиента / multipart-пути этапа 5 под несколько частей с именем поля `files` (правило 5: не копировать транспорт) | Перетаскивание в UI — [задача 3](./03-images-reorder.md) |
| Тесты на моке: поле `files`, не больше 10 файлов из стора при клиентском запрете, полный `imageIds`, пустой `imageIds` не уходит, `204` удаления → успех | Удаление в UI — [задача 4](./04-images-delete.md) |
| | `GET /compositions/:id/full` — принадлежит стору композиций, [задача 1 этапа 4](../step-4/01-compositions-store.md). Заметки, аудио — [этап 7](../../03-technical-specification.md#этап-7--заметки-а-знали-ли-вы) / [этап 5](../../03-technical-specification.md#этап-5--аудио-и-отрезки) |

## ⚠ Технические нюансы и ограничения

- Multipart-поле — **`files`**, несколько файлов, одно имя. Не `file`.
  Стор собирает `FormData` (`append('files', …)` на каждый файл) и
  передаёт его в метод клиента, который **не** ставит
  `Content-Type: application/json`. Если метод этапа 5 узко зашит под
  одно поле `file` — обобщить его здесь на втором использовании, не
  заводить второй `fetch`. Решение —
  [README этапа](./README.md#решения-по-открытым-вопросам-этапа).
- Клиентский запрет: 0 файлов и больше 10 метод загрузки не шлёт.
  Сервер при обходе: пустой набор — `400` `files is required`; 11-й
  файл — `400` `Unexpected field - files`. Отказ пробрасывается с
  `message`.
- Успех загрузки — `201` массив строк с `id`, `fileUrl`, `order`,
  `createdAt`. `fileUrl` есть сразу; опроса статусов нет. Presigned
  URL в стор как постоянный адрес не класть.
- Список — `200` массив без пагинации, в порядке `order`.
- Порядок — JSON `{ imageIds: string[] }`, полный текущий набор, хотя
  бы один id. Пустой массив метод не шлёт. Несовпадение набора —
  `400` с текстом из `IMAGE_ID_SET_MISMATCH_MESSAGE`. Ответ — массив
  с обновлённым `order` (индекс с 0).
- Путь порядка — `PATCH /compositions/:id/images/order` (литерал
  `order`), не путать с `.../images/:imageId`.
- Удаление — `204` без тела → клиент отдаёт `undefined`, метод стора
  считает это успехом и не парсит JSON повторно. Жёсткое удаление, не
  `200` с `deletedAt`.
- Сверхлимит размера на маршруте — `413` `File too large` (multer /
  `STORAGE_MAX_IMAGE_SIZE_BYTES`). Тип по содержимому — `415`
  `Unsupported or disallowed file type`. Показывать пришедший
  `message`.
- Методы кладутся рядом со стором композиций / аудио или в отдельный
  стор того же `root-store` — см. README. Второго HTTP-клиента нет.
  Файл перехватчика `401` эта задача не меняет.

## Объём работы

- Метод клиента (тот же модуль этапа 0 / обоб этапа 5): принять путь,
  метод и `FormData` / `BodyInit` с произвольным именем поля и
  несколькими частями; выставить `Authorization` при токене; **не**
  выставлять `Content-Type` вручную для multipart; разобрать успех и
  ошибку как у JSON-вызовов. Не дублировать транспорт отдельным
  `fetch`.
- Методы стора через этот клиент:
  - загрузка: `POST /compositions/:id/images`, `FormData` с полем
    `files` (1…10 файлов), успех `201` → массив;
  - список: `GET /compositions/:id/images` → массив;
  - порядок: `PATCH /compositions/:id/images/order`, тело
    `{ imageIds }`, успех `200` → массив;
  - удаление: `DELETE /compositions/:id/images/:imageId`, успех `204`.
- Тесты на моке `fetch`, без экрана:
  - загрузка шлёт multipart с именем поля `files`, не `file`; в
    заголовках нет `Content-Type: application/json`; несколько файлов —
    несколько частей с тем же именем;
  - вызов с 0 файлами или с >10 не уходит в сеть (клиентский запрет);
  - порядок шлёт JSON с ключом `imageIds` — полный переданный набор;
    вызов с `[]` сеть не трогает;
  - `DELETE` с `204` и пустым телом завершается успехом (`undefined`),
    без исключения парсера;
  - `400` / `413` / `415` пробрасываются с `message` сервера, ключ
    refresh в переданном хранилище остаётся.

## Критерии готовности

- Тесты из объёма работы проходят через `npm run test`.
- `npm run lint` проходит. `npm run build` проходит, если задача
  трогала публичные типы клиента или корневой стор.
- В модуле стора есть пути `.../images` и нет пути
  `/compositions/:id/full`. Проверяется чтением модуля.
