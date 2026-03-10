// ============================================================
// UNDERWRITING API — run engine and retrieve cached results
//
// TABLE OF CONTENTS
//   1.  underwritingApi   — run, getResults
//
// FLOW
//   POST /underwriting/run/:id   → evaluates all lenders, saves results, returns them
//   GET  /underwriting/results/:id → returns the last saved run (no re-evaluation)
//
// Re-running via POST deletes the prior run's match_results rows before
// inserting fresh ones (handled on the backend — FIX-2 re-run safety).
// ============================================================

import apiClient from './client';
import type { UnderwritingRunResponse } from '../types';


// region ── 1. underwritingApi ────────────────────────────────

export const underwritingApi = {

  /** POST /underwriting/run/:applicationId
   *  Triggers a full lender evaluation. Idempotent — safe to call multiple times.
   */
  run: (applicationId: number) =>
    apiClient
      .post<UnderwritingRunResponse>(`/underwriting/run/${applicationId}`)
      .then(r => r.data),

  /** GET /underwriting/results/:applicationId
   *  Returns the most recent saved run without re-evaluating.
   *  Throws if no run exists yet (404).
   */
  getResults: (applicationId: number) =>
    apiClient
      .get<UnderwritingRunResponse>(`/underwriting/results/${applicationId}`)
      .then(r => r.data),

};

// endregion