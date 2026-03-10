// ============================================================
// UNDERWRITING API CALLS
// ============================================================

import apiClient from './client';
import type { UnderwritingRunResponse } from '../types';

export const underwritingApi = {
  run: (applicationId: number) =>
    apiClient.post<UnderwritingRunResponse>(`/underwriting/run/${applicationId}`).then(r => r.data),

  getResults: (applicationId: number) =>
    apiClient.get<UnderwritingRunResponse>(`/underwriting/results/${applicationId}`).then(r => r.data),
};
