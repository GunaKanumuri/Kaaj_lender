// ============================================================
// API CLIENT — Axios instance with base URL and error normalisation
//
// TABLE OF CONTENTS
//   1.  Instance Config     — baseURL, default headers
//   2.  Response Interceptor — normalises error.response.data.detail
//                              into a plain Error so callers catch one type
//
// USAGE
//   import apiClient from './client';
//   apiClient.get<Lender[]>('/lenders/').then(r => r.data)
//
// All API modules (applications, lenders, underwriting) import from here.
// Never call fetch() directly in the codebase.
// ============================================================

import axios from 'axios';


// region ── 1. Instance Config ────────────────────────────────

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// endregion


// region ── 2. Response Interceptor ───────────────────────────

// FastAPI surfaces validation errors as { detail: string | object[] }.
// We flatten both shapes into a single Error.message so callers don't
// need to inspect the raw Axios error structure.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail  = error.response?.data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join('; ')
        : error.message || 'An unexpected error occurred';

    return Promise.reject(new Error(message));
  },
);

// endregion


export default apiClient;