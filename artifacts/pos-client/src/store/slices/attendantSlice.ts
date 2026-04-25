import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AttendantData {
  _id: string;
  username: string;
  uniqueDigits: number;
  shopId: string | { _id: string; name: string };
  adminId: string;
  permissions: Array<{ key: string; value: string[] }>;
  status: string;
  shopData?: any
}

interface AttendantState {
  attendant: AttendantData | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  shopData: any,
  currency: string
}

const initialState: AttendantState = {
  attendant: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  isRefreshing: false,
  shopData: null,
  currency: ""
};

const attendantSlice = createSlice({
  name: 'attendant',
  initialState,
  reducers: {
    setAttendant: (state, action: PayloadAction<{ attendant: AttendantData; token: string, shopData: any }>) => {
      state.attendant = action.payload.attendant;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.shopData = action.payload.shopData;
      state.currency = action.payload.shopData.currency
    },
    updateAttendant: (state, action: PayloadAction<AttendantData>) => {
      state.attendant = action.payload;
    },
    clearAttendant: (state) => {
      state.attendant = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.isRefreshing = false;
      state.currency = ""
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setRefreshing: (state, action: PayloadAction<boolean>) => {
      state.isRefreshing = action.payload;
    },
  },
});

export const { setAttendant, updateAttendant, clearAttendant, setLoading, setRefreshing } = attendantSlice.actions;
export default attendantSlice.reducer;