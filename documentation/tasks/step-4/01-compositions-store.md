# Задача 1 — Стор композиций и вызовы `/compositions`

Этап: 4 — Композиции.
Зависимости: [HTTP-клиент](../step-0/02-http-client.md) (JSON, пустой
успех → `undefined`, разбор `message`). Клиент уже подставляет access,
`401` обрабатывает [перехватчик](../step-1/02-refresh-on-401.md).
Новое поле добавляется в корневой стор
[`src/stores/root-store.ts`](../step-0/03-app-shell.md).
Ссылка на ТЗ: [раздел «Этап 4»](../../03-technical-specification.md#этап-4--композиции).
Карта: [композиции](../../02-staff-api.md#5-композиции).
Контроллер —
[`compositions.controller.ts`](../../../../quizbeat-srv/src/compositions/compositions.controller.ts),
query —
[`ListCompositionsQueryDto`](../../../../quizbeat-srv/src/compositions/dto/list-compositions-query.dto.ts),
тела —
[`CreateCompositionDto`](../../../../quizbeat-srv/src/compositions/dto/create-composition.dto.ts),
[`UpdateCompositionDto`](../../../../quizbeat-srv/src/compositions/dto/update-composition.dto.ts),
ответ —
[`CompositionResponseDto`](../../../../quizbeat-srv/src/compositions/dto/composition-response.dto.ts),
статус —
[`CompositionStatus`](../../../../quizbeat-srv/src/compositions/composition-status.enum.ts).
Поля, уже перечисленные в карте, здесь не повторяются.

## Зачем

Список, создание, карточка и удаление должны вызывать один модуль.
`tagIds` в query — строка через запятую, в теле `POST`/`PATCH` — массив
uuid; снятие набора — `[]`, а не отсутствие поля. `DELETE` отвечает
`200` с телом и `deletedAt`, в отличие от пустого `204` у тегов. Сеть
здесь проверяется моком `fetch`, без браузера. Форму запроса после этой
задачи выбирает стор, а не экран из [задачи 2](./02-compositions-list.md).

## Границы задачи

| Входит | Не входит |
|---|---|
| Доменный стор композиций и методы списка, создания, правки, удаления | Таблица, фильтры на экране, пункт меню — [задача 2](./02-compositions-list.md) |
| Сборка query: `search`, `status`, `tagIds` одной строкой через запятую, `page`, `limit` | Загрузка справочника тегов для UI — стор [этапа 3](../step-3/01-tags-store.md). Стор композиций принимает уже готовый массив uuid |
| Тела `POST`/`PATCH`: `tagIds` массивом; снятие набора — `tagIds: []` | Диалог создания — [задача 3](./03-create-composition.md). Карточка и её стык загрузки — [задача 4](./04-composition-card.md) |
| `DELETE` с успехом `200` и телом; передача `400` и `404` экрану как разобранной ошибки, без очистки сессии | Подтверждение удаления — [задача 5](./05-delete-composition.md) |
| | `GET /compositions/:id/full`, аудио, отрезки — [этап 5](../../03-technical-specification.md#этап-5--аудио-и-отрезки) / [этап 8](../../03-technical-specification.md#этап-8--сборка-карточки-композиции). Отдельного `GET /compositions/:id` нет — метод его не заводит |

## ⚠ Технические нюансы и ограничения

- В query списка `tagIds` — **одна** строка uuid через запятую
  (`?tagIds=uuid1,uuid2`), не повторяющийся параметр. Сервер режет её
  в массив
  ([`ListCompositionsQueryDto`](../../../../quizbeat-srv/src/compositions/dto/list-compositions-query.dto.ts))
  и трактует как OR. В теле `POST`/`PATCH` это массив строк-uuid. Путать
  формы — либо `400` валидации, либо фильтр не сработает как ждут.
- Переданный в `PATCH` `tagIds` заменяет набор целиком. Снять последний
  тег — отправить `[]`. Опустить поле значит оставить прежний набор на
  сервере
  ([`CompositionsService.update`](../../../../quizbeat-srv/src/compositions/compositions.service.ts)).
  Пустой массив разрешён: `assertTagsExistAndDedupe` для `[]` и
  `undefined` на создании сводит к пустому набору.
- Неизвестный uuid в `tagIds` — `400` и `message`
  `One or more tagIds do not reference an existing tag`
  ([`UNKNOWN_TAG_ID_MESSAGE`](../../../../quizbeat-srv/src/compositions/constants.ts)),
  не `409`. Нет композиции или она уже мягко удалена — `404`
  (`NotFoundException` без своей строки → дефолт Nest). Оба возвращаются
  экрану как ошибка с `message`. Стор сессии они не очищают и refresh не
  запускают. `401` по-прежнему обрабатывает перехватчик этапа 1.
- Дефолт статуса `DRAFT` ставит сервис при отсутствии поля в `POST`, не
  DTO. Метод создания, которому не передали `status`, поле в JSON не
  кладёт.
- `DELETE /compositions/:id` отвечает `200` с телом композиции и
  заполненным `deletedAt`. Это другой контракт, чем `DELETE /tags/:id`
  (`204` без тела). Метод стора читает JSON и не считает пустой ответ
  успехом на этом пути. Мягко удалённые в последующий `GET /compositions`
  не попадают (`deletedAt IS NULL` в сервисе).
- Отдельного `GET /compositions/:id` нет. Метода чтения одной строки и
  вызова `GET .../full` в этом сторе нет — их заведёт этап 8 на карточке.
- В `src/stores/root-store.ts` появляется поле `compositions` рядом с уже
  существующими. Файл HTTP-клиента и перехватчик `401` эта задача не
  меняет. Параллельно с задачей 2 её вести нельзя: экран вызывает методы
  ниже.

## Объём работы

- Стор MobX, один на приложение, поле корневого стора. Методы ходят
  через клиент этапа 0; access берётся из его геттера:
  - список: `GET /compositions`, ответ — страница
    `{ items, total, page, limit }`;
  - создание: `POST /compositions`, успех `201`;
  - правка: `PATCH /compositions/:id`, успех `200`;
  - удаление: `DELETE /compositions/:id`, успех `200` с телом.
- Query списка собирается в этом модуле. Пустой `search` и строка из
  одних пробелов в query не попадают. `status` уходит только если его
  передали. Непустой массив `tagIds` склеивается в одну строку через
  запятую; пустой массив и `undefined` параметра `tagIds` не содержат.
  `page` и `limit` уходят числами, когда их передал вызывающий код.
- Тела создания и правки: переданный `tagIds` уходит JSON-массивом
  uuid, в том числе `[]`. Если вызывающий код не передал `tagIds`, поля
  в JSON нет.
- Тесты на моке `fetch`:
  - два uuid в фильтре уходят одним query-параметром `tagIds` со
    значением `uuid1,uuid2`, без второго ключа `tagIds`;
  - пустой поиск, отсутствие статуса и пустой/отсутствующий набор тегов
    соответствующих параметров не содержат;
  - `PATCH`, которому передали `tagIds: []`, содержит в JSON ключ
    `tagIds` со значением `[]`, а не опускает поле;
  - `PATCH` без `tagIds` ключа `tagIds` в JSON не содержит;
  - ответ `DELETE` с телом `200` и `deletedAt` считается успехом и
    возвращает разобранный объект; пустой ответ не требуется;
  - при `400` с текстом про неизвестный тег и при `404` вызов
    завершается ошибкой с `message` сервера, ключ refresh в переданном
    хранилище остаётся, второго `fetch` на `/auth/staff/refresh` нет.

## Критерии готовности

- Тесты из объёма работы проходят через `npm run test`.
- `npm run lint` проходит.
- В модуле стора есть пути списка, `POST`, `PATCH`, `DELETE` и нет
  пути `/compositions/:id/full` и нет отдельного чтения
  `GET /compositions/:id`. Проверяется чтением модуля.
