import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Shop {
  id: string;
  name: string;
  type: string;
  location: string;
}

interface ShopState {
  selectedShopId: string | null;
  selectedShopData: any | null;
  availableShops: Shop[];
  isLoading: boolean;
  error: string | null;
}

const loadStoredShopData = (): any | null => {
  try {
    const raw = localStorage.getItem('selectedShopData');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const storedId = localStorage.getItem('selectedShopId');
    if (storedId && (data._id === storedId || data.id === storedId)) return data;
    return null;
  } catch {
    return null;
  }
};

const initialState: ShopState = {
  selectedShopId: localStorage.getItem('selectedShopId') || null,
  selectedShopData: loadStoredShopData(),
  availableShops: [],
  isLoading: false,
  error: null,
};

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    setSelectedShop: (state, action: PayloadAction<string>) => {
      state.selectedShopId = action.payload;
      localStorage.setItem('selectedShopId', action.payload);
    },
    setSelectedShopData: (state, action: PayloadAction<any>) => {
      state.selectedShopData = action.payload;
      if (action.payload) {
        localStorage.setItem('selectedShopData', JSON.stringify(action.payload));
      }
    },
    setAvailableShops: (state, action: PayloadAction<Shop[]>) => {
      state.availableShops = action.payload;
    },
    initializeSelectedShop: (state, action: PayloadAction<string | null>) => {
      const storedShopId = localStorage.getItem('selectedShopId');
      state.selectedShopId = storedShopId || action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearShopData: (state) => {
      state.selectedShopId = null;
      state.selectedShopData = null;
      state.availableShops = [];
      state.error = null;
      localStorage.removeItem('selectedShopId');
      localStorage.removeItem('selectedShopData');
    },
  },
});

export const {
  setSelectedShop,
  setSelectedShopData,
  setAvailableShops,
  initializeSelectedShop,
  setLoading,
  setError,
  clearShopData,
} = shopSlice.actions;

export default shopSlice.reducer;
