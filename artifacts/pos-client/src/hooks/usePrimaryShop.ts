import { useSelector } from 'react-redux';
import { useAuth } from '@/features/auth/useAuth';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';
import type { RootState } from '@/store';

interface PrimaryShopData {
  shopId: string;
  adminId: string;
  shopData?: any;
  userType: 'admin' | 'attendant' | null;
  attendantId: string | null,
  allowNegativeStock?: boolean
}

export const usePrimaryShop = (): PrimaryShopData => {
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const reduxSelectedShopId = useSelector((state: RootState) => state.shop.selectedShopId);
  const reduxSelectedShopData = useSelector((state: RootState) => state.shop.selectedShopData);

  // Attendant takes priority
  if (attendant) {
    const shopId = typeof attendant.shopId === 'string'
      ? attendant.shopId
      : attendant.shopId?._id || '';

    return {
      shopId,
      adminId: attendant.adminId || '',
      shopData: typeof attendant.shopId === 'object' ? attendant.shopId : null,
      userType: 'attendant',
      attendantId: attendant._id || attendant.id || '',
      allowNegativeStock: attendant?.shopData?.allownegativeselling,
    };
  }

  if (admin) {
    const adminId = admin._id || admin.id || '';

    // If Redux has full shop data that matches the selected shop ID, use it.
    // This is set by the dashboard on load and on shop switch — it's always current.
    if (reduxSelectedShopId && reduxSelectedShopData &&
        (reduxSelectedShopData._id === reduxSelectedShopId || reduxSelectedShopData.id === reduxSelectedShopId)) {
      return {
        shopId: reduxSelectedShopId,
        adminId,
        shopData: reduxSelectedShopData,
        userType: 'admin',
        attendantId: admin.attendantId || '',
        allowNegativeStock: reduxSelectedShopData?.allownegativeselling,
      };
    }

    // Fallback to API primaryShop
    const getShopId = (primaryShop: any) => {
      if (!primaryShop) return '';
      if (typeof primaryShop === 'string') return primaryShop;
      return primaryShop._id || primaryShop.id || '';
    };

    const shopId = getShopId(admin.primaryShop);
    return {
      shopId,
      adminId,
      shopData: typeof admin.primaryShop === 'object' ? admin.primaryShop : null,
      userType: 'admin',
      attendantId: admin.attendantId || '',
      allowNegativeStock: admin?.primaryShop?.allownegativeselling,
    };
  }

  // localStorage fallback (no auth context yet)
  try {
    const attendantData = localStorage.getItem('attendantData');
    if (attendantData) {
      const parsedAttendant = JSON.parse(attendantData);
      const shopId = typeof parsedAttendant.shopId === 'string'
        ? parsedAttendant.shopId
        : parsedAttendant.shopId?._id || '';
      return {
        shopId,
        adminId: parsedAttendant.adminId || '',
        attendantId: parsedAttendant._id || parsedAttendant.id || '',
        shopData: typeof parsedAttendant.shopId === 'object' ? parsedAttendant.shopId : null,
        userType: 'attendant',
      };
    }

    const adminData = localStorage.getItem('adminData');
    if (adminData) {
      const parsedAdmin = JSON.parse(adminData);
      const getShopId = (primaryShop: any) => {
        if (!primaryShop) return '';
        if (typeof primaryShop === 'string') return primaryShop;
        return primaryShop._id || primaryShop.id || '';
      };
      return {
        shopId: getShopId(parsedAdmin.primaryShop),
        attendantId: parsedAdmin.attendantId || '',
        adminId: parsedAdmin._id || parsedAdmin.id || '',
        shopData: typeof parsedAdmin.primaryShop === 'object' ? parsedAdmin.primaryShop : null,
        userType: 'admin',
      };
    }
  } catch {}

  return {
    shopId: '',
    adminId: '',
    shopData: null,
    userType: null,
    attendantId: null,
  };
};
