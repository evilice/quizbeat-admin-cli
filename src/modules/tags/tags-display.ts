import type { Tag, TagLocale } from './tags-store.ts';

export const EMPTY_TAGS_MESSAGE = 'Ничего не найдено';

export const DELETE_TAG_CONFIRM_TEXT =
  'Тег удаляется безвозвратно. Композиции, на которых он был, теряют с ним связь и сами не удаляются. Вернуть тег нельзя.';

export const tagTranslationName = (
  tag: Tag | null,
  locale: TagLocale,
): string => {
  if (tag === null) {
    return '';
  }
  return tag.translations.find((item) => item.locale === locale)?.name ?? '';
};
