import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import permissionsSlice from './slices/permissionsSlice';
import rolesSlice from './slices/rolesSlice';
import attendantSlice from './slices/attendantSlice';
import shopSlice from './shopSlice';
import currencySlice from './slices/defaultCurrencySlicce';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    permissions: permissionsSlice,
    roles: rolesSlice,
    attendant: attendantSlice,
    shop: shopSlice,
    currency: currencySlice
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;