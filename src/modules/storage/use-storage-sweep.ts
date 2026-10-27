import { useEffect, useState } from 'react';
import type { StorageSweepResult } from './storage-store.ts';
import { useRootStore } from '../../shared/store/root-store-context.tsx';
import { deleteSweepLabel } from './storage-display.ts';

export const useStorageSweep = () => {
  const { storage, session } = useRootStore();
  // Диалог привязан к тому предпросмотру, который подтверждают: новый или
  // сброшенный предпросмотр закрывает его сам и не открывает заново.
  const [confirmFor, setConfirmFor] = useState<StorageSweepResult | null>(null);
  const allowed = session.role === 'SUPER_ADMIN';

  useEffect(() => {
    return () => {
      storage.reset();
    };
  }, [storage]);

  const preview = storage.previewResult;
  const pending = storage.pending;
  const dialogOpen = preview !== null && confirmFor === preview;
  const canDelete =
    allowed && preview !== null && preview.total.count > 0 && !pending;

  const openConfirm = () => {
    if (!canDelete || !storage.requireFreshPreview()) {
      return;
    }
    storage.clearMessages();
    setConfirmFor(preview);
  };

  const closeConfirm = () => {
    if (storage.pending) {
      return;
    }
    // Причина отказа остаётся на странице: предпросмотр ещё годен для повтора.
    setConfirmFor(null);
  };

  const confirmSweep = async () => {
    if (storage.pending) {
      return;
    }
    await storage.sweep();
    // Итог или недействительный предпросмотр: диалогу больше нечего подтверждать.
    if (storage.outcome !== null || storage.previewResult === null) {
      setConfirmFor(null);
    }
  };

  return {
    allowed,
    pending,
    preview,
    outcome: storage.outcome,
    pageMessages: dialogOpen ? [] : storage.messages,
    dialogMessages: dialogOpen ? storage.messages : [],
    confirmOpen: dialogOpen,
    canDelete,
    deleteLabel:
      preview === null || preview.total.count === 0
        ? 'Удалить'
        : deleteSweepLabel(preview.total.count, preview.total.bytes),
    confirmCount: preview === null ? null : preview.total.count,
    confirmBytes: preview === null ? null : preview.total.bytes,
    check: () => storage.preview(),
    openConfirm,
    closeConfirm,
    confirmSweep,
  };
};
