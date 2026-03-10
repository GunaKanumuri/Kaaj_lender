// ============================================================
// LENDERS API CALLS
// ============================================================

import apiClient from './client';
import type { Lender, LenderProgram, PolicyRule } from '../types';

export const lendersApi = {
  list: () =>
    apiClient.get<Lender[]>('/lenders/').then(r => r.data),

  get: (id: number) =>
    apiClient.get<Lender>(`/lenders/${id}`).then(r => r.data),

  create: (data: Partial<Lender>) =>
    apiClient.post<Lender>('/lenders/', data).then(r => r.data),

  update: (id: number, data: Partial<Lender>) =>
    apiClient.put<Lender>(`/lenders/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete(`/lenders/${id}`),

  addProgram: (lenderId: number, data: Partial<LenderProgram>) =>
    apiClient.post<LenderProgram>(`/lenders/${lenderId}/programs`, data).then(r => r.data),

  updateProgram: (programId: number, data: Partial<LenderProgram>) =>
    apiClient.put<LenderProgram>(`/lenders/programs/${programId}`, data).then(r => r.data),

  deleteProgram: (programId: number) =>
    apiClient.delete(`/lenders/programs/${programId}`),

  addRule: (programId: number, data: Partial<PolicyRule>) =>
    apiClient.post<PolicyRule>(`/lenders/programs/${programId}/rules`, data).then(r => r.data),

  updateRule: (ruleId: number, data: Partial<PolicyRule>) =>
    apiClient.put<PolicyRule>(`/lenders/rules/${ruleId}`, data).then(r => r.data),

  deleteRule: (ruleId: number) =>
    apiClient.delete(`/lenders/rules/${ruleId}`),
};
