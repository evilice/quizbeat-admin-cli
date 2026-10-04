import type { Tag, TagLocale } from '../tags/tags-store.ts';
import type { CompositionStatus } from './compositions-store.ts';

export const STATUS_LABELS: Record<CompositionStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликована',
};

export const EMPTY_COMPOSITIONS_MESSAGE = 'Ничего не найдено';

export const COMPOSITION_NOT_FOUND_MESSAGE = 'Композиция не найдена';

export const DELETE_COMPOSITION_CONFIRM_TEXT =
  'Композиция исчезнет из списка. Вернуть её из интерфейса нельзя — отдельного восстановления на сервере нет.';

export const translationName = (tag: Tag, locale: TagLocale): string => {
  return tag.translations.find((item) => item.locale === locale)?.name ?? '';
};

export const tagDisplayName = (tag: Tag): string => {
  return translationName(tag, 'ru') || tag.code;
};
