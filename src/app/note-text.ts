import type {
  CompositionNote,
  NoteTranslation,
} from '../stores/compositions-store.ts';

export function noteText(
  note: Pick<CompositionNote, 'translations'>,
  locale: NoteTranslation['locale'],
): string {
  return note.translations.find((item) => item.locale === locale)?.text ?? '';
}
