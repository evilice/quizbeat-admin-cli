import type { CompositionNote, NoteTranslation } from './notes-store.ts';

export function noteText(
  note: Pick<CompositionNote, 'translations'>,
  locale: NoteTranslation['locale'],
): string {
  return note.translations.find((item) => item.locale === locale)?.text ?? '';
}
