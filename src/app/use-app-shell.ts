import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router';
import { ApiError, messagesFromError } from '../shared/api/api-error.ts';

import { useRootStore } from '../shared/store/root-store-context';

const hasRefresh = (token: string | null): boolean => {
  return token !== null && token !== '';
};
function hasAccess(token: string | null): boolean {
  return token !== null && token !== '';
}

export const useAppShell = () => {
  const { session } = useRootStore();
  const pathname = useLocation().pathname;
  const signedIn = hasAccess(session.accessToken);

  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [restorePending, setRestorePending] = useState(
    () => hasRefresh(session.refreshToken) && !hasAccess(session.accessToken),
  );
  const [restoreMessages, setRestoreMessages] = useState<
    readonly string[] | null
  >(null);

  useEffect(() => {
    if (!hasRefresh(session.refreshToken) || hasAccess(session.accessToken)) {
      setRestorePending(false);
      return;
    }

    let cancelled = false;
    void session
      .restore()
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (!(error instanceof ApiError && error.status === 401)) {
          setRestoreMessages(messagesFromError(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRestorePending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, setRestoreMessages, setRestorePending]);

  return useMemo(() => {
    return {
      pathname,
      signedIn,
      session,
      accountAnchor,
      restorePending,
      restoreMessages,
      setAccountAnchor,
    };
  }, [
    pathname,
    signedIn,
    accountAnchor,
    session,
    restorePending,
    restoreMessages,
    setAccountAnchor,
  ]);
};
