import { useState, useEffect } from 'react';

export type NetworkStatus = 'online' | 'offline';

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(
    typeof navigator !== 'undefined' && navigator.onLine !== undefined
      ? (navigator.onLine ? 'online' : 'offline')
      : 'online'
  );
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatus('online');
      setLastCheck(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
      setLastCheck(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkNetwork = () => {
    const online = navigator.onLine !== false;
    setIsOnline(online);
    setStatus(online ? 'online' : 'offline');
    setLastCheck(new Date());
    return online;
  };

  return {
    status,
    isOnline,
    isOffline: !isOnline,
    lastCheck,
    checkNetwork,
  };
}
