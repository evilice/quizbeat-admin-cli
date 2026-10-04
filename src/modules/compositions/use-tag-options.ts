import { useEffect, useState } from 'react';
import { messagesFromError } from '../../shared/api/api-error.ts';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import type { Tag } from '../tags/tags-store.ts';

const TAGS_PAGE_LIMIT = 100;
/** Предохранитель от бесконечного цикла при кривом `total`. */
const MAX_TAG_PAGES = 50;

type TagOptions = {
  tagOptions: Tag[];
  tagMessages: readonly string[];
};

export const useTagOptions = (): TagOptions => {
  const { tags } = useRootStore();
  const [state, setState] = useState<TagOptions>({
    tagOptions: [],
    tagMessages: [],
  });

  useEffect(() => {
    let cancelled = false;

    const loadAll = async (): Promise<Tag[]> => {
      const all: Tag[] = [];
      for (let page = 1; page <= MAX_TAG_PAGES; page += 1) {
        const result = await tags.list({ page, limit: TAGS_PAGE_LIMIT });
        all.push(...result.items);
        if (result.items.length === 0 || all.length >= result.total) {
          break;
        }
      }
      return all;
    };

    void loadAll()
      .then((tagOptions) => {
        if (!cancelled) {
          setState({ tagOptions, tagMessages: [] });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            tagOptions: [],
            tagMessages: messagesFromError(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tags]);

  return state;
};
