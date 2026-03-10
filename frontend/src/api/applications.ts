// ============================================================
// APPLICATIONS API — CRUD operations for loan applications
//
// TABLE OF CONTENTS
//   1.  applicationsApi   — list, get, create, update, delete
//
// All methods return the unwrapped data payload (r.data), so callers
// get typed values without destructuring the Axios response wrapper.
// ============================================================

import apiClient from './client';
import type { Application, ApplicationFormData } from '../types';


// region ── 1. applicationsApi ────────────────────────────────

export const applicationsApi = {

  /** GET /applications/ — returns all applications, newest first. */
  list: () =>
    apiClient.get<Application[]>('/applications/').then(r => r.data),

  /** GET /applications/:id */
  get: (id: number) =>
    apiClient.get<Application>(`/applications/${id}`).then(r => r.data),

  /** POST /applications/ — creates application with nested business/guarantor/loan_request. */
  create: (data: ApplicationFormData) =>
    apiClient.post<Application>('/applications/', data).then(r => r.data),

  /** PUT /applications/:id — partial update (pass only changed fields). */
  update: (id: number, data: Partial<ApplicationFormData>) =>
    apiClient.put<Application>(`/applications/${id}`, data).then(r => r.data),

  /** DELETE /applications/:id — also cascades to match_results via FK. */
  delete: (id: number) =>
    apiClient.delete(`/applications/${id}`),

};

// endregion