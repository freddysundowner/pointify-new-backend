import { useEffect } from 'react';
import { AuthService } from '@/services/authService';
import { useAppSelector } from '@/store/hooks';

export default function PermissionsInit({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Initialize with default user if no user is logged in
    if (!user) {
      AuthService.simulateLogin('manager'); // Start with manager role for demo
    }
  }, [user]);

  return <>{children}</>;
}