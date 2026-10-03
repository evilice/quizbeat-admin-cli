import type { CompositionStatus } from './compositions-store.ts';
import type { Tag, TagLocale } from '../../modules/tags/tags-store.ts';

export const STATUS_LABELS: Record<CompositionStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликована',
};

export function tagDisplayName(tag: Tag): string {
  return translationName(tag, 'ru') || tag.code;
}

export function translationName(tag: Tag, locale: TagLocale): string {
  return tag.translations.find((item) => item.locale === locale)?.name ?? '';
}
