import { configureStore } from '@reduxjs/toolkit'

import authenticationReducer from '@/features/authentication/slice'

export const store = configureStore({
  reducer: {
    authentication: authenticationReducer,
  },
})
