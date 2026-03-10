// ============================================================
// APPLICATIONS API CALLS
// ============================================================

import apiClient from './client';
import type { Application, ApplicationFormData } from '../types';

export const applicationsApi = {
  list: () =>
    apiClient.get<Application[]>('/applications/').then(r => r.data),

  get: (id: number) =>
    apiClient.get<Application>(`/applications/${id}`).then(r => r.data),

  create: (data: ApplicationFormData) =>
    apiClient.post<Application>('/applications/', data).then(r => r.data),

  update: (id: number, data: Partial<ApplicationFormData>) =>
    apiClient.put<Application>(`/applications/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete(`/applications/${id}`),
};
