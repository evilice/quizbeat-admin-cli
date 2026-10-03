import { useState } from 'react';

/** Держит последнее ненулевое значение, чтобы подпись диалога не пустела при закрытии. */
export const useLastValue = <T>(value: T | null): T | null => {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) {
    setLast(value);
  }
  return value ?? last;
};
