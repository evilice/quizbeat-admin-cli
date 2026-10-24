# Задача 1 — Стор видео композиции

Этап: 9 — Видео композиции.
Зависимости: серверный этап 14,
[задача 3](../../../../quizbeat-srv/documentation/tasks/step-14/03-composition-video-endpoints.md);
[HTTP-клиент](../step-0/02-http-client.md) и multipart-путь
([задача 1 этапа 5](../step-5/01-audio-clips-store.md), поле `file`);
карточка и `GET /full` — [задача 4 этапа 4](../step-4/04-composition-card.md).
Ссылка на ТЗ: [раздел «Этап 9»](../../03-technical-specification.md#этап-9--видео-композиции).

## Зачем

Вызовы и правила обновления видео — отдельный слой, который проще
покрыть тестом на моке до появления UI. Так же разделены стор и экран в
этапах 5–7.

## Границы задачи

| Входит | Не входит |
|---|---|
| Стор: `save(file, startSec, endSec)` (`POST .../video`, multipart: `file`, `startSec`, `endSec`), `refreshUrl()` (`GET .../video`), `remove()` (`DELETE`, `204`) | Разметка, плеер, выбор отрезка — [задача 2](./02-video-trim-editor.md) |
| Чтение `videoUrl`, `videoDurationSec` из `GET /full` (оба `null`, если видео нет) | Прогресс-бар загрузки |
| Раздел «Видео» в [02-staff-api.md](../../02-staff-api.md) (§9) | Игровой API |
| Тесты на моке | — |

## ⚠ Технические нюансы и ограничения

- Multipart: поле файла — `file` (одно), текстовые поля `startSec` и
  `endSec` — **в `FormData` до или после файла, но строками**; `Content-Type`
  вручную не выставлять (boundary). Числа форматировать без экспоненты.
- `POST` отвечает `{ videoDurationSec }` без URL — после него обязателен
  `GET .../video`; старый `videoUrl` сбросить до ответа.
- `GET .../video` без видео — `404`: для стора «видео нет», не ошибка
  экрана (`full` уже сообщил `null`).
- Ошибки сервера `400` (границы, нет видеопотока), `413`, `415` —
  текст `message` через общий разбор ошибки; запрос длится десятки
  секунд — не ставить на него короткий клиентский таймаут и не повторять
  автоматически.

## Объём работы

- Стор в `src/modules/compositions/video/video-store.ts`, подключение к
  стору карточки.
- Раздел в `02-staff-api.md` (после проверки по коду сервера).

## План работы

Порядок — от типов и контракта к стору, от теста к коду; `npm run lint` и
`npm run test` — после каждого шага (правило 8), `npm run build` — в конце
(задача трогает тип `CompositionFull`, который собирает карточку). Новых
зависимостей нет.

**Шаги.**

1. **Разведка (сделана, повторить при реализации).**
   - Сторы проекта **без состояния данных**: `AudioClipsStore.uploadAudio`
     возвращает результат, а `full` держит хук карточки
     (`use-composition-card.ts`, образец — `handleAudioUploaded`). Поэтому
     «сбросить `videoUrl`» из критериев — это правка `full` в хуке (задача 3),
     а `VideoStore` отдаёт только результаты вызовов. Дублировать `videoUrl`
     в сторе нельзя: два источника правды разойдутся.
   - Образец multipart — `AudioClipsStore.uploadAudio`: `FormData` +
     `api.requestForm`, `Content-Type` не выставляется. У `fetch` в
     `api-client.ts` таймаута нет — длинная обрезка не оборвётся.
   - Пустое тело ответа `requestForm` возвращает как `undefined`: `POST`
     обязан бросить `ApiError(null, [...])` на `undefined`, как
     `uploadAudio` (`Пустой ответ загрузки трека`).
   - Контракт сверить по коду сервера:
     [контроллер](../../../../quizbeat-srv/src/composition-video/composition-video.controller.ts),
     `UploadVideoDto`, `VideoUrlResponseDto`, `CompositionFullResponseDto`
     (`videoUrl`, `videoDurationSec` — `null`, не отсутствуют). Сервер на
     момент плана готов (серверный этап 14, задача 3 выполнена).
2. **Типы.** В `compositions-store.ts` расширить `CompositionFull`:
   `videoUrl: string | null`, `videoDurationSec: number | null`. Прогнать
   `npm run build`: ломаются фикстуры `CompositionFull` в тестах
   (`compositions-store.test.ts`, `CompositionCard.test.tsx`,
   `ImagesBlock.test.tsx`) — добавить оба поля `null`.
3. **Тесты стора (TDD, красные).** `video/video-store.test.ts` по образцу
   `images-store.test.ts` (мок `fetch`, `SessionStore` с токеном):
   - `save`: `POST /compositions/:id/video`, тело — `FormData` с `file`,
     `startSec`, `endSec` строками, без заголовка `Content-Type:
     application/json`; результат `{ videoDurationSec }` возвращается как есть;
     пустой ответ → `ApiError`;
   - `getUrl`: `GET`, возвращает строку `url`; `404` → `null` (видео нет),
     другие статусы пробрасываются;
   - `remove`: `DELETE`, `204` без тела — не ошибка;
   - `400`/`413`/`415`/`422` попадают в `messagesFromError` как есть;
   - числа в `FormData`: `String(1.5)` → `'1.5'`; проверить значения вроде
     `0.1 + 0.2` — после округления до 2 знаков в UI (задача 2) в стор
     приходит уже округлённое, стор само не округляет и не форматирует.
4. **Стор.** `video/video-store.ts`: `class VideoStore { constructor(api) }`
   с методами `save(compositionId, file, startSec, endSec)`,
   `getUrl(compositionId)` (`404` → `null`), `remove(compositionId)`.
   Подключить в `RootStore` полем `video` (после `notes`). Блокировка
   повторной отправки — **не в сторе** (состояние экрана, раздел 11 правил):
   это флаг `busy` в хуке редактора (задача 2); критерий «повторная
   отправка во время идущей блокируется» проверяется там тестом на
   компонент, а в этой задаче — тестом, что стор не вызывает `fetch`
   повторно сам (ровно один запрос на `save`).
5. **Карта API.** Раздел `## 9. Видео` в `02-staff-api.md` (после заметок),
   прежний `## 9. Что клиент не вызывает` → `## 10.`. Ссылок на старый
   якорь в репозитории нет (проверено `grep`), но проверить заново.
   Содержимое — по коду сервера: три метода, поля, коды `400/404/413/415/422`,
   дефолтные лимиты (`STORAGE_MAX_VIDEO_SIZE_BYTES` 500 МБ,
   `VIDEO_MAX_CLIP_DURATION_SEC` 60, `VIDEO_MAX_RESULT_SIZE_BYTES` 100 МБ,
   `FFMPEG_VIDEO_TIMEOUT_MS` 120 с), синхронность запроса, `POST` без URL в
   ответе, presigned `videoUrl`. В §5 карты дополнить описание `GET .../full`
   двумя полями; в §1 список временных ссылок — `videoUrl`.
6. **Ревью.** `/code-review` уровня `medium` в отдельном контексте.
   Человеческое ревью не обязательно (нет сессии/ролей/токенов); в отчёт —
   короткий список: загрузка файла идёт через общий `requestForm`, ошибки
   сервера не перетираются клиентскими текстами.

**Принятый риск.** Клиентские лимиты (500 МБ, 60 с) — зеркала серверных
env-значений, которые на стенде могут быть другими. Источник истины —
ответ сервера; расхождение проявится как `413`/`400` с текстом `message`.

## Критерии готовности

- `npm run test`, `npm run lint`, `npm run build` проходят.
- Тесты на моке: `save` шлёт multipart с полями `file`, `startSec`,
  `endSec`; после успеха `videoUrl` сброшен и затем запрошен
  `GET .../video`; `remove` обнуляет оба поля; `404` на `GET` — «видео
  нет»; `400`/`413`/`415` попадают в сообщение ошибки; повторная
  отправка во время идущей блокируется.
