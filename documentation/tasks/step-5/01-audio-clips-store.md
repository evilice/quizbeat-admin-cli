# Задача 1 — Стор аудио и отрезков

Этап: 5 — Аудио и отрезки.
Зависимости: [HTTP-клиент](../step-0/02-http-client.md) (низкоуровневый
вызов без навязанного `Content-Type: application/json`, JSON-обёртка,
пустой успех → `undefined`, разбор `message`). Access и `401` — уже
через [перехватчик](../step-1/02-refresh-on-401.md). Стор композиций и
корневой стор —
[задача 1 этапа 4](../step-4/01-compositions-store.md) /
[`src/stores/root-store.ts`](../step-0/03-app-shell.md).
Ссылка на ТЗ: [раздел «Этап 5»](../../03-technical-specification.md#этап-5--аудио-и-отрезки).
Карта: [аудио и отрезки](../../02-staff-api.md#6-аудио-и-отрезки).
Контроллеры —
[`compositions.controller.ts`](../../../../quizbeat-srv/src/compositions/compositions.controller.ts)
(`POST`/`GET .../audio`),
[`audio-clips.controller.ts`](../../../../quizbeat-srv/src/audio-clips/audio-clips.controller.ts).
DTO —
[`UploadAudioResponseDto`](../../../../quizbeat-srv/src/compositions/dto/upload-audio-response.dto.ts),
[`AudioUrlResponseDto`](../../../../quizbeat-srv/src/compositions/dto/audio-url-response.dto.ts),
[`CreateAudioClipsDto`](../../../../quizbeat-srv/src/audio-clips/dto/create-audio-clips.dto.ts),
[`CreateAudioClipPointDto`](../../../../quizbeat-srv/src/audio-clips/dto/create-audio-clip-point.dto.ts),
[`AudioClipResponseDto`](../../../../quizbeat-srv/src/audio-clips/dto/audio-clip-response.dto.ts).
Сообщения —
[`audio-clips/constants.ts`](../../../../quizbeat-srv/src/audio-clips/constants.ts).
Поля, уже перечисленные в карте, здесь не повторяются.

## Зачем

Загрузка, ссылка на оригинал, создание точек, список, удаление и
перегенерация должны ходить через один модуль. Multipart с чужим именем
поля или JSON-заголовком на `FormData` отвалится до проверки типа.
`DELETE` отвечает пустым `204`, а `fileUrl` до `DONE` в JSON нет —
экран без зафиксированного контракта легко примет успех удаления за сбой
или нарисует плеер по `null`. Экран и опрос в эту задачу не входят: сеть
проверяется моком `fetch`.

## Границы задачи

| Входит | Не входит |
|---|---|
| Методы стора: `POST .../audio`, `GET .../audio`, `POST .../clips`, `GET .../clips`, `DELETE .../clips/:clipId`, `POST .../clips/:clipId/regenerate` | Блок загрузки на карточке — [задача 2](./02-audio-upload.md) |
| Расширение того же HTTP-клиента под `FormData` (один метод / низкоуровневый вызов без `Content-Type: application/json`) | Волна, разметка, отправка с UI — [задача 3](./03-waveform-and-points.md) |
| Тесты на моке: поле `file`, тело `{ points }`, отсутствие выдуманного `fileUrl` до `DONE`, `204` удаления → успех | Опрос по таймеру — [задача 4](./04-clips-list-and-poll.md). Стор делает разовый `GET`, не `setInterval` |
| | Удаление/перегенерация в UI — [задача 5](./05-clip-delete-and-regenerate.md) |
| | `GET /compositions/:id/full`, картинки (`files`), заметки — [этап 8](../../03-technical-specification.md#этап-8--сборка-карточки-композиции) / [этап 6](../../03-technical-specification.md#этап-6--изображения-композиции) / [этап 7](../../03-technical-specification.md#этап-7--заметки-а-знали-ли-вы) |

## ⚠ Технические нюансы и ограничения

- Multipart-поле — **`file`**, одно. Не `files`. Стор собирает
  `FormData` и передаёт его в метод клиента, который **не** ставит
  `Content-Type: application/json` (границу ставит браузер). JSON-обёртка
  этапа 0 для этого вызова не подходит. Решение и место правки клиента —
  [README этапа](./README.md#решения-по-открытым-вопросам-этапа).
- Успех загрузки — `201` с `{ originalAudioDurationSec }`. URL оригинала
  в этом ответе нет. Успех ссылки — `200` с `{ url }` и только им;
  длительности в ответе нет. Presigned `url` в стор как постоянный адрес
  не класть.
- Создание отрезков — JSON `{ points: [...] }`, хотя бы одна точка.
  Пустой массив метод не шлёт. `startTimeSec` — целое. Ответ — массив;
  у новых строк статус обычно `PENDING`, поля `fileUrl` нет.
- Список — массив без пагинации. В объекте без `DONE` ключа `fileUrl`
  нет — это не `null`. Тест не должен требовать `fileUrl: null`.
- Удаление — `204` без тела → клиент отдаёт `undefined`, метод стора
  считает это успехом и не парсит JSON повторно.
- Перегенерация — `200` с отрезком в `PENDING`. `409` с
  `Audio clip is already pending or being processed` — ошибка экрану,
  сессию не чистить. Нет оригинала при создании точек — `409`
  `Composition has no uploaded original audio track`. Точка за
  длительностью — `400`
  `Point is out of the original audio track duration range`.
- `404` на `GET .../audio` (нет оригинала) и на клипах — разобранная
  ошибка вызывающему коду; стор сессии не очищать. Интерпретацию
  «трек не загружен» делает экран задачи 2 / 3, не этот модуль.
- Методы кладутся рядом со стором композиций или в отдельный стор того
  же `root-store` — см. README. Второго HTTP-клиента нет. Файл
  перехватчика `401` эта задача не меняет.

## Объём работы

- Метод клиента (тот же модуль этапа 0): принять путь, метод и
  `FormData` / `BodyInit`, выставить `Authorization` при токене, **не**
  выставлять `Content-Type` вручную для multipart, разобрать успех и
  ошибку как у JSON-вызовов.
- Методы стора через этот клиент:
  - загрузка: `POST /compositions/:id/audio`, `FormData` с полем `file`,
    успех `201` → `{ originalAudioDurationSec }`;
  - ссылка: `GET /compositions/:id/audio` → `{ url }`;
  - создание: `POST /compositions/:id/clips`, тело `{ points }`, успех
    `201` → массив отрезков;
  - список: `GET /compositions/:id/clips` → массив;
  - удаление: `DELETE /compositions/:id/clips/:clipId`, успех `204`;
  - перегенерация: `POST /compositions/:id/clips/:clipId/regenerate` →
    отрезок.
- Тесты на моке `fetch`, без экрана и без таймеров:
  - загрузка шлёт multipart с именем поля `file`, не `files`; в
    заголовках запроса нет `Content-Type: application/json`;
  - создание шлёт JSON с ключом `points` и хотя бы одной точкой
    (`startTimeSec` целое, `durationSec` из допустимого набора,
    `difficulty` enum);
  - ответ списка/`201` без `fileUrl` при статусе не `DONE` не
    дополняется клиентом полем `fileUrl`;
  - `DELETE` с `204` и пустым телом завершается успехом (`undefined`),
    без исключения парсера;
  - `409` / `400` / `415` / `413` пробрасываются с `message` сервера,
    ключ refresh в переданном хранилище остаётся.

## Критерии готовности

- Тесты из объёма работы проходят через `npm run test`.
- `npm run lint` проходит. `npm run build` проходит, если задача трогала
  публичные типы клиента или корневой стор.
- В модуле стора есть пути `.../audio` и `.../clips` и нет пути
  `/compositions/:id/full`. Проверяется чтением модуля.
