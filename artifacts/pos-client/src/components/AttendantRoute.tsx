import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';

interface AttendantRouteProps {
  children: React.ReactNode;
}

export const AttendantRoute = ({ children }: AttendantRouteProps) => {
  const { isAuthenticated, isLoading } = useAttendantAuth();
  const [, setLocation] = useLocation();

  console.log('=== ATTENDANT ROUTE GUARD ===');
  console.log('isLoading:', isLoading);
  console.log('isAuthenticated:', isAuthenticated);
  console.log('localStorage attendantData:', !!localStorage.getItem('attendantData'));
  console.log('Current path:', window.location.pathname);

  useEffect(() => {
    // Check localStorage as fallback for authentication
    const attendantData = localStorage.getItem('attendantData');
    const hasAttendantSession = isAuthenticated || attendantData;
    
    console.log('AttendantRoute effect - hasAttendantSession:', hasAttendantSession);
    
    if (!isLoading && !hasAttendantSession) {
      console.log('AttendantRoute: Redirecting to attendant login');
      setLocation('/attendant/login');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    console.log('AttendantRoute: Showing loading state');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check localStorage as fallback
  const attendantData = localStorage.getItem('attendantData');
  const hasAttendantSession = isAuthenticated || attendantData;

  if (!hasAttendantSession) {
    console.log('AttendantRoute: No session, returning null');
    return null;
  }

  console.log('AttendantRoute: Rendering children');
  return <>{children}</>;
};