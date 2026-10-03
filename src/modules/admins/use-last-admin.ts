import { useState } from 'react';
import type { Admin } from './admins-store.ts';

/** Держит последнего открытого сотрудника, чтобы заголовок диалога не пустел при закрытии. */
export const useLastAdmin = (admin: Admin | null): Admin | null => {
  const [last, setLast] = useState(admin);
  if (admin !== null && admin !== last) {
    setLast(admin);
  }
  return admin ?? last;
};
