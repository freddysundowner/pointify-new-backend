import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';

export const AttendantSessionChecker = () => {
  const { isAuthenticated, isLoading } = useAttendantAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    console.log('=== ATTENDANT SESSION CHECK ===');
    console.log('Current location:', location);
    console.log('isLoading:', isLoading);
    console.log('isAuthenticated:', isAuthenticated);
    console.log('localStorage attendantData:', !!localStorage.getItem('attendantData'));
    
    // Only handle attendant-specific routes, don't interfere with any other routes
    if (!isLoading && location.startsWith('/attendant/')) {
      // Check localStorage for attendant data as fallback
      const attendantData = localStorage.getItem('attendantData');
      const hasAttendantSession = isAuthenticated || attendantData;
      
      console.log('Has attendant session:', hasAttendantSession);
      console.log('Should redirect to login:', location !== '/attendant/login' && !hasAttendantSession);
      
      // If we're on attendant routes and not authenticated, redirect to login
      if (location !== '/attendant/login' && !hasAttendantSession) {
        console.log('Redirecting to attendant login from session checker');
        setLocation('/attendant/login');
      }
      
      // If we're authenticated attendant and on attendant login page, redirect appropriately
      if (hasAttendantSession && location === '/attendant/login') {
        const attendantData = localStorage.getItem('attendantData');
        if (attendantData) {
          try {
            const attendant = JSON.parse(attendantData);
            const hasCanSell = attendant.permissions?.some((p: any) => 
              p.key === 'pos' && p.value?.includes('can_sell')
            );
            
            if (hasCanSell) {
              console.log('Redirecting authenticated attendant with can_sell to POS');
              setLocation('/attendant/pos');
            } else {
              console.log('Redirecting authenticated attendant to dashboard');
              setLocation('/attendant/dashboard');
            }
          } catch {
            setLocation('/attendant/dashboard');
          }
        } else {
          setLocation('/attendant/dashboard');
        }
      }
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  return null;
};