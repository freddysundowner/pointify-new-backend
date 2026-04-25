import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const defaultCurrency = createSlice({
    name: 'currency',
    initialState: "",
    reducers: {
        setCurrency: (state, action: PayloadAction<string>) => {
            state = action.payload;
            return state;
        },
    },
})

export const { setCurrency } = defaultCurrency.actions;
export default defaultCurrency.reducer;