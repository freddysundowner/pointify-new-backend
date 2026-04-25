import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export type NetworkStatus = 'online' | 'offline';

interface NetworkStatusResponse {
  status: NetworkStatus;
  isOnline: boolean;
  isOffline: boolean;
  timestamp: string;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>('online');
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  // Query network status from backend
  const { data: networkData, refetch } = useQuery<NetworkStatusResponse>({
    queryKey: ['/api/network/status'],
    refetchInterval: 30000, // Check every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    onSuccess: (data) => {
      setStatus(data.status);
      setIsOnline(data.isOnline);
      setLastCheck(new Date(data.timestamp));
    },
  });

  // Browser online/offline detection as fallback
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Browser detected: online');
      setIsOnline(true);
      setStatus('online');
      refetch(); // Verify with backend
    };

    const handleOffline = () => {
      console.log('🌐 Browser detected: offline');
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status based on browser
    if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
      setIsOnline(navigator.onLine);
      setStatus(navigator.onLine ? 'online' : 'offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refetch]);

  // Manual network check
  const checkNetwork = async () => {
    try {
      const response = await fetch('/api/network/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data: NetworkStatusResponse = await response.json();
        setStatus(data.status);
        setIsOnline(data.isOnline);
        setLastCheck(new Date(data.timestamp));
        return data;
      }
    } catch (error) {
      console.error('Network check failed:', error);
      setStatus('offline');
      setIsOnline(false);
    }
    return null;
  };

  return {
    status,
    isOnline,
    isOffline: !isOnline,
    lastCheck,
    checkNetwork,
    refetch,
  };
}