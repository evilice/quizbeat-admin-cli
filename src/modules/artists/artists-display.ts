export const EMPTY_ARTISTS_MESSAGE = 'Ничего не найдено';

export const DELETE_ARTIST_CONFIRM_TEXT =
  'Удалить можно только исполнителя, который не используется ни в одной композиции. Вернуть его нельзя.';

export const ARTIST_RENAME_HINT = 'Имя изменится у всех композиций';

export const artistInUseMessage = (compositionCount: number): string => {
  return `Исполнитель используется в композициях: ${compositionCount}. Удалить нельзя.`;
};
