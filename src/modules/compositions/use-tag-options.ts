import { useEffect, useState } from 'react';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import type { Tag } from '../tags/tags-store.ts';

const TAGS_FILTER_LIMIT = 100;

export const useTagOptions = (): Tag[] => {
  const { tags } = useRootStore();
  const [tagOptions, setTagOptions] = useState<Tag[]>([]);

  useEffect(() => {
    let cancelled = false;

    void tags
      .list({ limit: TAGS_FILTER_LIMIT })
      .then((pageResult) => {
        if (!cancelled) {
          setTagOptions(pageResult.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTagOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tags]);

  return tagOptions;
};
