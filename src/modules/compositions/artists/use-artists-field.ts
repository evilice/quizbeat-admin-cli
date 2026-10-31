import { useEffect, useRef, useState } from 'react';
import type { AutocompleteInputChangeReason } from '@mui/material/Autocomplete';
import { ApiError, messagesFromError } from '../../../shared/api/api-error.ts';
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from '../../../shared/hooks/use-debounced-value.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import type { Artist, CompositionArtist } from '../../artists/artists-store.ts';

/** Предел выдачи автодополнения; весь справочник не загружается. */
const ARTISTS_SEARCH_LIMIT = 20;
/** Для поиска точного совпадения после `409` — с запасом. */
const ARTISTS_EXACT_SEARCH_LIMIT = 100;

export type CreateArtistOption = {
  kind: 'create';
  name: string;
};

/** Значение `Autocomplete`: запись справочника или служебный пункт «Создать». */
export type ArtistOption = CompositionArtist | CreateArtistOption;

export const isCreateArtistOption = (
  option: ArtistOption,
): option is CreateArtistOption => {
  return 'kind' in option && option.kind === 'create';
};

const normalizeName = (name: string): string => {
  return name.trim().toLowerCase();
};

/**
 * Оставляет серверную выдачу как есть (клиент не фильтрует по введённому
 * тексту) и добавляет «Создать «…»», если точного совпадения имени нет.
 */
export const buildArtistOptions = (
  options: ArtistOption[],
  inputValue: string,
): ArtistOption[] => {
  const name = inputValue.trim();
  if (name === '') {
    return options;
  }
  const hasExactMatch = options.some((option) => {
    return (
      !isCreateArtistOption(option) &&
      normalizeName(option.name) === normalizeName(name)
    );
  });
  return hasExactMatch ? options : [...options, { kind: 'create', name }];
};

export const useArtistsField = (
  value: CompositionArtist[],
  onChange: (artists: CompositionArtist[]) => void,
  onCreatingChange?: (creating: boolean) => void,
) => {
  const { artists } = useRootStore();
  const [inputValue, setInputValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<Artist[]>([]);
  const [loadedSearch, setLoadedSearch] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const requestIdRef = useRef(0);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const loading =
    searchText.trim() !== '' && loadedSearch !== searchText.trim();

  useEffect(() => {
    if (search === '') {
      requestIdRef.current += 1;
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let cancelled = false;

    void artists
      .list({ search, page: 1, limit: ARTISTS_SEARCH_LIMIT })
      .then((page) => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }
        setOptions(page.items);
        setLoadedSearch(search);
      })
      .catch((error: unknown) => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }
        setOptions([]);
        setLoadedSearch(search);
        setMessages(messagesFromError(error));
      });

    return () => {
      cancelled = true;
    };
  }, [artists, search]);

  const appendArtist = (artist: CompositionArtist): void => {
    const current = valueRef.current;
    if (current.some((item) => item.id === artist.id)) {
      return;
    }
    onChange([...current, artist]);
  };

  const findExactArtist = async (name: string): Promise<Artist | undefined> => {
    const page = await artists.list({
      search: name,
      page: 1,
      limit: ARTISTS_EXACT_SEARCH_LIMIT,
    });
    const normalized = normalizeName(name);
    return page.items.find((item) => normalizeName(item.name) === normalized);
  };

  const clearSearch = (): void => {
    // Ответ уже отправленного поиска не должен вернуть старую выдачу.
    requestIdRef.current += 1;
    setInputValue('');
    setSearchText('');
    setOptions([]);
    setLoadedSearch(null);
  };

  const createArtist = async (rawName: string): Promise<void> => {
    const name = rawName.trim();
    if (name === '' || creating) {
      return;
    }

    setCreating(true);
    onCreatingChange?.(true);
    setMessages([]);
    try {
      const created = await artists.create({ name });
      appendArtist({ id: created.id, name: created.name });
      clearSearch();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const existing = await findExactArtist(name);
          if (existing !== undefined) {
            appendArtist({ id: existing.id, name: existing.name });
            clearSearch();
            return;
          }
        } catch (searchError) {
          setMessages(messagesFromError(searchError));
          return;
        }
      }
      setMessages(messagesFromError(error));
    } finally {
      setCreating(false);
      onCreatingChange?.(false);
    }
  };

  const handleChange = (next: readonly ArtistOption[]): void => {
    const createOption = next.find(isCreateArtistOption);
    if (createOption !== undefined) {
      void createArtist(createOption.name);
      return;
    }
    onChange(
      next
        .filter((option): option is CompositionArtist => {
          return !isCreateArtistOption(option);
        })
        .map((artist) => ({ id: artist.id, name: artist.name })),
    );
  };

  const handleInputChange = (
    next: string,
    reason: AutocompleteInputChangeReason,
  ): void => {
    setInputValue(next);
    if (reason === 'input') {
      setSearchText(next);
      setMessages([]);
      if (next.trim() === '') {
        requestIdRef.current += 1;
        setOptions([]);
        setLoadedSearch(null);
      }
    } else if (reason === 'clear') {
      requestIdRef.current += 1;
      setSearchText('');
      setOptions([]);
      setLoadedSearch(null);
    }
  };

  const removeArtist = (artistId: string): void => {
    onChange(valueRef.current.filter((artist) => artist.id !== artistId));
  };

  const moveArtist = (index: number, delta: number): void => {
    const current = valueRef.current;
    const target = index + delta;
    if (target < 0 || target >= current.length) {
      return;
    }
    const next = [...current];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) {
      return;
    }
    next.splice(target, 0, moved);
    onChange(next);
  };

  return {
    inputValue,
    options,
    loading,
    messages,
    handleChange,
    handleInputChange,
    removeArtist,
    moveArtist,
  };
};
