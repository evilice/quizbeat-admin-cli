# Задача 1 — Поле «Исполнители» в композициях

Этап: 12 — Исполнители вместо автора.
Зависимости: серверный этап 17,
[задача 2](../../../../quizbeat-srv/documentation/tasks/step-17/02-staff-artists-and-compositions.md)
(`/artists`, `artistIds`, `artists`), контроллер
[`artists.controller.ts`](../../../../quizbeat-srv/src/artists/artists.controller.ts)
и DTO композиций
[`create-composition.dto.ts`](../../../../quizbeat-srv/src/compositions/dto/create-composition.dto.ts),
[`update-composition.dto.ts`](../../../../quizbeat-srv/src/compositions/dto/update-composition.dto.ts);
[HTTP-клиент](../step-0/02-http-client.md); композиции —
[этап 4](../step-4/README.md).
Ссылка на ТЗ: [раздел «Этап 12»](../../03-technical-specification.md#этап-12--исполнители-вместо-автора).
Карта: разделы «Композиции» и «Исполнители» в
[staff-api.md](https://github.com/evilice/quizbeat-docs/blob/main/api/staff-api.md)
(появились в серверной задаче 2). Поля запроса и ответа здесь не
повторяются.

## Зачем

Поле «Автор» стоит в нескольких местах — создание, правка, список, карточка и
диалог удаления; заменять его по частям значит держать клиент в промежуточном
состоянии, которое сервер не принимает. Поэтому одна задача: стор
исполнителей и все места композиции переключаются вместе.

## Границы задачи

| Входит | Не входит |
|---|---|
| Стор `artists`: `list({ search, page, limit })`, `create({ name })` | Страница справочника, переименование и удаление — [задача 2](./02-artists-page.md) |
| Компонент «Исполнители»: `Autocomplete multiple`, поиск на сервере, «создать», порядок стрелками | Изменение сервера |
| Создание и правка композиции с `artistIds` | Фильтр списка по исполнителю |
| Колонка «Исполнители» в списке, заголовок карточки, диалог удаления, подпись поиска | Разбор составных значений вроде «A, B» на нескольких исполнителей |
| Единая функция подписи и отдельная функция заголовка карточки | Картинки, аудио, видео, заметки |

## ⚠ Технические нюансы и ограничения

- **`artistIds` — зеркало `tagIds`.** Опущен при создании, если не выбрано
  ни одного. В правке уходит **полный упорядоченный набор** только если
  пользователь его менял (как `tagsTouched` у тегов); снять всех —
  `artistIds: []`, а не отсутствие поля. Проверить, как это сделано для тегов
  в `use-edit-composition.ts`, и сделать так же, не придумывать второй
  признак «изменено».
- **Порядок значим и сохраняется.** Массив `artistIds` — в порядке чипов;
  ответ сервера (`artists`) тоже упорядочен; не сортировать на клиенте.
- **`artists` есть в ответе всегда,** в том числе `[]`: и в списке, и в
  `GET .../full`. Отдельного `author` в DTO больше нет, подставлять пустую
  строку вместо массива нельзя.
- **Два типа исполнителя.** `/artists` отдаёт `Artist` (`id`, `name`,
  `createdAt`), а композиция — `CompositionArtist` (`id`, `name`), как
  `CompositionArtistDto` сервера. Не типизировать `Composition.artists` и
  значение поля через `Artist`: лишний `createdAt` в типе врёт о контракте и
  ломает фикстуры.
- **Поиск только на сервере и с задержкой.** `GET /artists?search=` с
  `limit=20` (и `page=1`); запрос уходит после `SEARCH_DEBOUNCE_MS` из
  `shared/hooks/use-debounced-value.ts`. Устаревший ответ отбрасывается по
  номеру запроса: `ApiClient` не принимает `AbortSignal`, сетевой отмены нет,
  поэтому «отмена» здесь — только игнорирование позднего ответа.
- **Опции в `Autocomplete` — по `id`,** а не по имени: уже выбранные
  исполнители берутся из `composition.artists` (их может не быть в текущей
  выдаче поиска). Сравнение `isOptionEqualToValue` по `id`. Значение поля —
  `CompositionArtist[]`, а не `string[]`: иначе чипы потеряют имя при смене
  выдачи; `Artist[]` из поиска подходит как опции, но в `value` идут только
  `{ id, name }`.
- **MUI 9.4: чипы рисует `renderValue`, а не `renderTags`.** В установленной
  версии `renderTags` нет; для стрелок «выше/ниже» использовать
  `renderValue(value, getItemProps)` и кнопки в чипе. `getOptionLabel` —
  имя. `filterOptions` переопределить: MUI по умолчанию фильтрует опции по
  введённому тексту, а поиск уже сделан сервером — иначе результаты
  «пропадут». Там же добавляется служебная опция «Создать «…»», когда
  точного совпадения нет; она не должна попадать в `value`. Поиск запускать
  только при `onInputChange` с `reason === 'input'`: выбор чипа сбрасывает
  строку с `reason: 'reset'` и иначе даёт лишний запрос. Для multiple —
  `disableCloseOnSelect`, `noOptionsText` «Ничего не найдено» и текст
  загрузки, чтобы список не выглядел пустым во время запроса.
- **Создание «на лету».** Пункт «Создать «Имя»» показывается, если среди
  результатов нет совпадения имени без учёта регистра. Это служебная опция
  отдельного типа (например, `{ kind: 'create', name }`), а не `Artist`: она
  не должна попадать в `value`; в `onChange`/`renderOption` её перехватывают,
  вызывают `POST`, а в выбранные добавляют созданного `CompositionArtist`.
  `POST /artists` может вернуть `409` (гонка или другой регистр, пока шёл
  поиск) — тогда клиент повторяет поиск по этому имени и выбирает запись с
  точным совпадением `lower(trim(name))`, а не первую подстроку и не
  показывает ошибку. Если точного совпадения нет, показать ошибку в диалоге.
- **Имя — `trim`, пустое не создаётся.** Сообщение об ошибке показывается один
  раз, рядом с полем (в форме карточки или в диалоге создания), как у
  остальных ошибок композиций; выбранные чипы при ошибке поиска не сбрасываются.
- **Заголовок карточки получает исполнителей из `location.state`.** Сейчас
  `use-compositions-list.ts` кладёт в состояние `{ title, author }`, а
  `use-composition-card.ts` читает `locationState?.author` до загрузки
  `GET .../full`. Заменить на `{ title, artists }` в обоих местах, иначе
  заголовок пропадёт до загрузки. `mergeCompositionIntoFull` тоже должен
  переносить `artists`, а не `author`.
- **Заголовок без второго тире.** Подпись «—» — для пустого значения в
  списке и диалоге удаления. В карточке поле формы пустое — это отсутствие
  чипов, а не «—»; подпись там нужна только для заголовка. Заголовок
  собирается отдельно: `название — A, B`, а без исполнителей — только
  `название`. Нельзя подставлять «—» в шаблон `название — подпись`:
  получится «Песня — —».
- **Пустой список — «—»,** а не пустая ячейка и не слово «нет».
- **Файлы, которые трогает и [задача 2](./02-artists-page.md):**
  `root-store.ts`, `src/app/routes.tsx`, `PagesMenu.tsx`. Эта задача
  только регистрирует стор в `root-store.ts`; маршрут и меню добавляет
  задача 2.
- **Новые папки — в `.oxlintrc.json`.** `src/modules/compositions/artists/`
  попадает в `overrides` с `func-style: expression` (раздел 11 правил),
  иначе новый код не проверится тем же линтером, что остальные экраны.
- **Тесты и хелперы строят композиции с `author`.** Обновить:
  `compositions-test-helpers.tsx` (общий `sampleComposition` — `artists: []`),
  `compositions-store.test.ts` (тела `POST`/`PATCH`),
  `CreateComposition.test.tsx` (поле «Исполнители», нет «Укажите автора»),
  `CompositionsList.test.tsx` (непустые `artists` для колонки и подписи),
  `CompositionCard.test.tsx` (`location.state` с `artists`, заголовок с
  исполнителями и без), `AudioAndClips.test.tsx`,
  `ImagesBlock.test.tsx`, `NotesBlock.test.tsx`,
  `SavedVideoBlock.test.tsx` (фикстуры `artists: []`; ожидание заголовка
  «Song Two — Author» заменить). Иначе `tsc -b` падает, а
  `grep -rnE '\bauthor\b' src` не станет чистым. `App.test.tsx` эта задача
  не меняет: пункт меню появится в [задаче 2](./02-artists-page.md).
- **Общие файлы документации и линтера.** `status.md`, `README.md` этапа,
  ТЗ и `.oxlintrc.json` правит каждая задача в своём PR; задача 2 идёт после
  задачи 1 и дополняет их. Конфликт в `.oxlintrc.json` тривиален: задача 1
  добавляет `src/modules/compositions/artists/**`, задача 2 — пути
  `src/modules/artists/**`.

## Объём работы

- `src/modules/artists/artists-store.ts` (+ тест), регистрация в
  `src/shared/store/root-store.ts`. Типы `Artist` (`id`, `name`, `createdAt`)
  для `/artists`, `CompositionArtist` (`id`, `name`) для ответа композиции и
  значения поля; `Artist` можно объявить как `CompositionArtist` плюс
  `createdAt: string`. Ещё `PaginatedArtists`, `ListArtistsParams`.
- `src/modules/compositions/artists/`: `ArtistsField.tsx` и
  `use-artists-field.ts` — поиск, создание, выбранные значения и порядок.
  Поле принадлежит форме композиции, поэтому лежит во вложенном модуле
  композиций, как `audio/`, `images/`, `notes/`; стор — в `modules/artists`.
- `src/modules/compositions/compositions-store.ts`: `Composition.artists`,
  `CreateCompositionInput.artistIds`, `UpdateCompositionInput.artistIds`,
  тела `create`/`update` без `author`.
- `create/` (`CreateCompositionDialog.tsx`, `use-create-composition.ts`),
  `edit/` (`CompositionEditForm.tsx`, `use-edit-composition.ts`).
- `card/use-composition-card.ts`, `CompositionCardPage.tsx`,
  `list/use-compositions-list.ts`, `list/CompositionsTable.tsx`,
  `list/DeleteCompositionDialog.tsx`, `list/CompositionsFilters.tsx`,
  `composition-display.ts` (подпись и заголовок).
- Тесты: стор исполнителей, поле (поиск, создание, порядок, `409`,
  устаревший ответ), форма создания и правки, список, карточка, заголовок.
- `.oxlintrc.json`, документация: ТЗ, [status.md](../status.md),
  `README.md` этапа; `staff-api.md` не правится (владелец — сервер).

## План реализации

Тесты пишутся до реализации; шаги 3–6 делают их зелёными. Регистрация стора
входит в шаг реализации, а не идёт после тестов; маршрут и меню — в задаче 2.

1. **Разведка (правило 1).** Прочитать `TagsStore`, `use-tag-options.ts`,
   `use-debounced-value.ts`, `use-edit-composition.ts` (как ведёт себя
   `tagsTouched`), `CompositionEditForm`, `CreateCompositionDialog`,
   `use-compositions-list.ts` и `use-composition-card.ts` (состояние
   навигации), `CompositionCardPage.tsx` (заголовок). Прочитать разделы
   `staff-api.md`, `artists.controller.ts` и DTO композиций: если форма
   ответа разошлась с этой задачей, верен код сервера (CLAUDE.md проекта).
2. **Тесты сначала (на моке `fetch`).** Стор: `list` шлёт `search`, `page` и
   `limit`, `create` шлёт `{ name }`, ответ типизирован с `createdAt`. Поле:
   ввод шлёт запрос после паузы, устаревший ответ игнорируется; выбор
   нескольких сохраняет порядок; «Создать» вызывает `POST` и выбирает
   результат; `409` → повторный поиск и выбор найденного; выбранные чипы не
   пропадают при смене строки поиска; стрелки меняют порядок. Создание: без
   исполнителей — тело без `artistIds`, публикация допустима; с двумя —
   `artistIds` в порядке выбора. Правка: `[]` уходит при снятии всех, без
   изменения поле не уходит, при смене порядка уходит полный набор. Список,
   карточка, диалог и заголовок показывают подпись; без исполнителей в
   заголовке нет второго тире. Обновить фикстуры
   `compositions-test-helpers.tsx`, `AudioAndClips.test.tsx`,
   `ImagesBlock.test.tsx`, `NotesBlock.test.tsx`,
   `SavedVideoBlock.test.tsx` — иначе тесты и `tsc -b` не сойдутся.
3. **Стор `artists`** (`makeAutoObservable`, как `TagsStore`): `list`,
   `create`, типы `Artist`/`CompositionArtist`; зарегистрировать в
   `root-store.ts`. `update`/`remove` добавит задача 2.
4. **Функции подписи и заголовка** с тестами: `artistNames(artists)` →
   `join(', ')` или «—»; `compositionHeading(title, artists)` → только
   название, если исполнителей нет.
5. **Поле «Исполнители»:** `ArtistsField` + `use-artists-field`; подключить
   к форме создания и правки. В правке — `artistsTouched` по образцу
   `tagsTouched`, после сохранения сбросить и взять `updated.artists`.
6. **Список, карточка, диалог удаления, фильтры:** заголовок колонки и
   подпись, заголовок карточки через `compositionHeading`, подпись поиска
   «Поиск по названию или исполнителю», `location.state` с `artists`;
   удалить `author` из типов, тел запросов и `mergeCompositionIntoFull`.
7. **`.oxlintrc.json`, обновление тестов, документация;** `npm run test`,
   `lint`, `build`; `/code-review` (правило 7) и Impact; без подтверждения
   не коммитить.

## Критерии готовности

- `npm run test`, `npm run lint`, `npm run build` проходят; в `src` нет
  поля `author` у композиции (`grep -rnE '\bauthor\b' src` пуст; слова
  `Authorization`/`unauthorized` под шаблон не попадают). Фикстуры в
  `compositions-test-helpers.tsx`, `AudioAndClips.test.tsx`,
  `ImagesBlock.test.tsx`, `NotesBlock.test.tsx`,
  `SavedVideoBlock.test.tsx`, `CompositionsList.test.tsx`,
  `CompositionCard.test.tsx`, `CreateComposition.test.tsx`,
  `compositions-store.test.ts` обновлены.
- Тесты на моке: создание без исполнителей отправляет тело без `artistIds`;
  порядок выбора совпадает с порядком `artistIds`; правка отправляет `[]` при
  снятии и ничего — без изменений; смена порядка отправляет полный набор;
  `409` при создании исполнителя разбирается без ошибки на экране;
  устаревший ответ поиска не перетирает свежий.
- Тестами проверено: подпись — несколько имён через запятую, пусто — «—» в
  списке и диалоге удаления; заголовок карточки без исполнителей — только
  название, без «—»; поле формы без исполнителей — без чипов.
- Ручной проход на живом сервере — в [задаче 3](./03-step12-acceptance.md).
