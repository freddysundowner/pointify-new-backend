import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { useLocation } from 'wouter';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setAttendant, updateAttendant, clearAttendant, setLoading, setRefreshing } from '@/store/slices/attendantSlice';
import { setCurrency } from '@/store/slices/defaultCurrencySlicce';

interface AttendantData {
  _id: string;
  username: string;
  uniqueDigits: number;
  shopId: string | { _id: string; name: string };
  adminId: string;
  permissions: Array<{ key: string; value: string[] }>;
  status: string;
  shopData?: any
}

interface AttendantAuthContextType {
  attendant: AttendantData | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  login: (attendantData: AttendantData, token: string,shopData: any) => void;
  logout: () => void;
  refreshAttendantData: () => Promise<void>;
}

const AttendantAuthContext = createContext<AttendantAuthContextType | undefined>(undefined);

export const useAttendantAuth = () => {
  const context = useContext(AttendantAuthContext);
  if (context === undefined) {
    throw new Error('useAttendantAuth must be used within an AttendantAuthProvider');
  }
  return context;
};

interface AttendantAuthProviderProps {
  children: ReactNode;
}

export const AttendantAuthProvider = ({ children }: AttendantAuthProviderProps) => {
  const dispatch = useAppDispatch();
  const { attendant, token, isAuthenticated, isLoading, isRefreshing } = useAppSelector(state => state.attendant);
  const [, setLocation] = useLocation();

  useEffect(() => {
    initializeAttendantAuth();
  }, []);

  const initializeAttendantAuth = () => {
    try {
      const storedAttendantData = localStorage.getItem('attendantData');
      const storedToken = localStorage.getItem('attendantToken');
      const storedShopData = localStorage.getItem('shopData');
      if (storedAttendantData && storedToken) {
        const parsedData = JSON.parse(storedAttendantData);
        
        // Map the stored data to the expected AttendantData structure
        const attendantData: AttendantData = {
          _id: parsedData.attendantId || parsedData._id,
          username: parsedData.username || '',
          uniqueDigits: parsedData.uniqueDigits || 96580,
          shopId: parsedData.shopId,
          adminId: parsedData.adminId,
          permissions: parsedData.permissions || [],
          status: parsedData.status || 'active',
          shopData: JSON.parse(storedShopData || '{}')
        };
        dispatch(setCurrency(storedShopData?.currency || 'KES'));
        dispatch(setAttendant({ attendant: attendantData, token: storedToken, shopData: JSON.parse(storedShopData || '{}') }));
        setLocation('/');
      }
    } catch (error) {
      console.error('Failed to initialize attendant auth:', error);
      logout();
    } finally {
      dispatch(setLoading(false));
    }
  };

  const login = (attendantData: AttendantData, authToken: string, shopData: any) => {
    dispatch(setAttendant({ attendant: attendantData, token: authToken,shopData }));
    localStorage.setItem('attendantData', JSON.stringify(attendantData));
    localStorage.setItem('shopData', JSON.stringify(shopData));
    localStorage.setItem('attendantToken', authToken);
  };

  const logout = () => {
    dispatch(clearAttendant());
    localStorage.removeItem('attendantData');
    localStorage.removeItem('attendantToken');
    localStorage.removeItem('shopData');
    setLocation('/login-selection');
  };

  const refreshAttendantData = async () => {
    if (!token || !attendant?._id) return;
    
    dispatch(setRefreshing(true));
    try {
      const response = await fetch(ENDPOINTS.auth.attendantVerify, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.attendant) {
          // Update both Redux state and localStorage with properly structured data
          dispatch(updateAttendant(data.attendant));
          localStorage.setItem('attendantData', JSON.stringify(data.attendant));
        }
      } else {
        // Only log out on authentication errors (401), not on data fetch failures
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error && errorData.error.includes('Token expired')) {
            logout();
          } else {
            console.log('Refresh failed but keeping session active:', errorData.error);
            throw new Error('Refresh failed but session maintained');
          }
        } else {
          throw new Error('Network error during refresh');
        }
      }
    } catch (error) {
      console.error('Failed to refresh attendant data:', error);
      // Don't log out on network errors, just keep existing data
    } finally {
      dispatch(setRefreshing(false));
    }
  };

  const value = {
    attendant,
    token,
    isAuthenticated,
    isLoading,
    isRefreshing,
    login,
    logout,
    refreshAttendantData,
  };

  return (
    <AttendantAuthContext.Provider value={value}>
      {children}
    </AttendantAuthContext.Provider>
  );
};