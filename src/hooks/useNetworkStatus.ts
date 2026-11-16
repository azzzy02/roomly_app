import { useEffect, useState } from 'react';
import type { ConnectionState } from '@/src/types/chat';

export function useNetworkStatus(
  hasInitialSnapshot: boolean,
  isFromCache: boolean,
  listenerError: boolean
): ConnectionState {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return 'offline';
  }
  if (listenerError) {
    return 'error';
  }
  if (!hasInitialSnapshot) {
    return 'connecting';
  }
  if (isFromCache) {
    return 'reconnecting';
  }
  return 'connected';
}
