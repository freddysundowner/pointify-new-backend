import { useEffect } from 'react';
import { useLocation } from 'wouter';
import UserSwitchPage from './UserSwitchPage';

interface AdminRouteHandlerProps {
  targetRoute: string;
}

export default function AdminRouteHandler({ targetRoute }: AdminRouteHandlerProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const attendantData = localStorage.getItem('attendantData');
    if (attendantData) {
      try {
        const attendant = JSON.parse(attendantData);
        const hasCanSell = attendant.permissions?.some((p: any) => 
          p.key === 'pos' && p.value?.includes('can_sell')
        );
        
        if (hasCanSell) {
          setLocation('/attendant/pos');
        } else {
          setLocation('/attendant/dashboard');
        }
      } catch {
        setLocation('/attendant/dashboard');
      }
    }
  }, [setLocation]);

  const attendantData = localStorage.getItem('attendantData');
  if (attendantData) {
    return null; // Will redirect via useEffect
  }

  return <UserSwitchPage targetRoute={targetRoute} />;
}