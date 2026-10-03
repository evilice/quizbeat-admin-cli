import { useState, type SubmitEvent } from 'react';
import { messagesFromError } from '../../../shared/api/api-error.ts';
import { useRootStore } from '../../../shared/store/root-store-context.tsx';
import { tagTranslationName } from '../tags-display.ts';
import type { Tag, TagTranslation } from '../tags-store.ts';

export const useTagForm = (
  tag: Tag | null,
  onClose: () => void,
  onSaved: () => void,
) => {
  const { tags } = useRootStore();
  const [code, setCode] = useState(tag?.code ?? '');
  const [nameRu, setNameRu] = useState(
    tag !== null ? tagTranslationName(tag, 'ru') : '',
  );
  const [nameEn, setNameEn] = useState(
    tag !== null ? tagTranslationName(tag, 'en') : '',
  );
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setCode('');
    setNameRu('');
    setNameEn('');
    setMessages([]);
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (code === '') {
      setMessages(['Укажите код']);
      return;
    }
    if (nameRu === '') {
      setMessages(['Укажите название (ru)']);
      return;
    }
    if (nameEn === '') {
      setMessages(['Укажите название (en)']);
      return;
    }

    const translations: TagTranslation[] = [
      { locale: 'ru', name: nameRu },
      { locale: 'en', name: nameEn },
    ];

    setSubmitting(true);
    setMessages([]);
    try {
      if (tag === null) {
        await tags.create({ code, translations });
      } else {
        await tags.update(tag.id, { code, translations });
      }
      resetForm();
      onSaved();
    } catch (error) {
      setMessages(messagesFromError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    code,
    setCode,
    nameRu,
    setNameRu,
    nameEn,
    setNameEn,
    messages,
    submitting,
    handleClose,
    handleSubmit,
  };
};
