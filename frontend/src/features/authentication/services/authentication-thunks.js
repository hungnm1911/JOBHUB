import { createAsyncThunk } from '@reduxjs/toolkit'

import { registerCandidateApi } from '@/apis/authentication.api'

import { login, registerCompanyManager } from './authentication.service'

// Credentials stay in authentication storage; thunk payloads never carry tokens.
// ApiError is not serializable, so rejections carry only its transport fields.
function toRejectedValue(error) {
  return {
    message: error?.message ?? null,
    status: error?.status ?? null,
    code: error?.code ?? null,
    details: error?.details ?? null,
  }
}

const loginThunk = createAsyncThunk(
  'authentication/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const authentication = await login(credentials)
      return { user: authentication.user }
    } catch (error) {
      return rejectWithValue(toRejectedValue(error))
    }
  },
)

const registerCandidateThunk = createAsyncThunk(
  'authentication/registerCandidate',
  async (registration, { rejectWithValue }) => {
    try {
      const result = await registerCandidateApi(registration)
      return { user: result.user }
    } catch (error) {
      return rejectWithValue(toRejectedValue(error))
    }
  },
)

const registerCompanyManagerThunk = createAsyncThunk(
  'authentication/registerCompanyManager',
  async (registration, { rejectWithValue }) => {
    try {
      const authentication = await registerCompanyManager(registration)
      return { user: authentication.user, company: authentication.company }
    } catch (error) {
      return rejectWithValue(toRejectedValue(error))
    }
  },
)

export { loginThunk, registerCandidateThunk, registerCompanyManagerThunk }
