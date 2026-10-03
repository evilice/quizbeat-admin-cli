import { arrayMove } from '@dnd-kit/sortable';
import type { CompositionImage } from './images-store.ts';

export function nextImageIds(
  ids: readonly string[],
  activeId: string,
  overId: string | null,
): string[] | null {
  if (overId === null || activeId === overId) {
    return null;
  }

  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0) {
    return null;
  }

  return arrayMove([...ids], from, to);
}

export function imagesInOrder(
  images: readonly CompositionImage[],
  ids: readonly string[],
): CompositionImage[] {
  const byId = new Map(images.map((image) => [image.id, image]));
  return ids.flatMap((id, index) => {
    const image = byId.get(id);
    if (image === undefined) {
      return [];
    }
    return [{ ...image, order: index }];
  });
}
