// ============================================================
// LENDERS API — CRUD for lenders, programs, and policy rules
//
// TABLE OF CONTENTS
//   1.  lendersApi.lender  — list, get, create, update, delete
//   2.  lendersApi.program — addProgram, updateProgram, deleteProgram
//   3.  lendersApi.rule    — addRule, updateRule, deleteRule
//
// The lendersApi object is flat (no nesting) for ergonomic call-sites:
//   lendersApi.addRule(programId, payload)
// rather than:
//   lendersApi.rules.add(programId, payload)
// ============================================================

import apiClient from './client';
import type { Lender, LenderProgram, PolicyRule } from '../types';


// region ── 1. Lender CRUD ────────────────────────────────────

export const lendersApi = {

  /** GET /lenders/ — returns all lenders with nested programs and rules. */
  list: () =>
    apiClient.get<Lender[]>('/lenders/').then(r => r.data),

  /** GET /lenders/:id */
  get: (id: number) =>
    apiClient.get<Lender>(`/lenders/${id}`).then(r => r.data),

  /** POST /lenders/ */
  create: (data: Partial<Lender>) =>
    apiClient.post<Lender>('/lenders/', data).then(r => r.data),

  /** PUT /lenders/:id */
  update: (id: number, data: Partial<Lender>) =>
    apiClient.put<Lender>(`/lenders/${id}`, data).then(r => r.data),

  /** DELETE /lenders/:id — also removes all programs and rules (FK cascade). */
  delete: (id: number) =>
    apiClient.delete(`/lenders/${id}`),

  // endregion


  // region ── 2. Program CRUD ─────────────────────────────────

  /** POST /lenders/:lenderId/programs */
  addProgram: (lenderId: number, data: Partial<LenderProgram>) =>
    apiClient.post<LenderProgram>(`/lenders/${lenderId}/programs`, data).then(r => r.data),

  /** PUT /lenders/programs/:programId */
  updateProgram: (programId: number, data: Partial<LenderProgram>) =>
    apiClient.put<LenderProgram>(`/lenders/programs/${programId}`, data).then(r => r.data),

  /** DELETE /lenders/programs/:programId */
  deleteProgram: (programId: number) =>
    apiClient.delete(`/lenders/programs/${programId}`),

  // endregion


  // region ── 3. Rule CRUD ────────────────────────────────────

  /** POST /lenders/programs/:programId/rules */
  addRule: (programId: number, data: Partial<PolicyRule>) =>
    apiClient.post<PolicyRule>(`/lenders/programs/${programId}/rules`, data).then(r => r.data),

  /** PUT /lenders/rules/:ruleId */
  updateRule: (ruleId: number, data: Partial<PolicyRule>) =>
    apiClient.put<PolicyRule>(`/lenders/rules/${ruleId}`, data).then(r => r.data),

  /** DELETE /lenders/rules/:ruleId */
  deleteRule: (ruleId: number) =>
    apiClient.delete(`/lenders/rules/${ruleId}`),

  // endregion
};