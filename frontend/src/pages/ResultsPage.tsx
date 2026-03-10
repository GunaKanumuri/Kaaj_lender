// ============================================================
// src/pages/ResultsPage.tsx
//
// Underwriting results for an application.
//
// Data loading strategy (avoids the 404 race condition):
//   1. If navigation state contains runResult (passed from
//      ApplicationFormPage after a successful POST /run), use
//      it directly — no extra GET needed.
//   2. Otherwise GET /underwriting/results/:id.
//   3. If GET returns 404, auto-trigger POST /run once.
//      This handles navigating directly to a /results/:id URL
//      for an app that hasn't been run yet.
//
// TABLE OF CONTENTS
//   1.  ResultsPage component
//       1a. data loading: state → GET → auto-run fallback
//       1b. rerun handler
//       1c. render: loading / error / results
// ============================================================

import { useEffect, useState }        from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  CheckCircle, XCircle, ArrowLeft, RefreshCw, Building2,
  AlertTriangle, Loader2,
} from 'lucide-react';
import { underwritingApi }            from '../api/underwriting';
import { LenderMatchCard }            from '../components/domain/LenderMatchCard';
import { Button }                     from '../components/ui/Button';
import { Card }                       from '../components/ui/Card';
import type { UnderwritingRunResponse } from '../types';


// region ── 1. ResultsPage ────────────────────────────────────

export default function ResultsPage() {
  const { id }       = useParams<{ id: string }>();
  const location     = useLocation();
  const appId        = Number(id);

  const [data,      setData]      = useState<UnderwritingRunResponse | null>(
    // 1. If ApplicationFormPage passed results via navigate state, use them immediately
    (location.state as any)?.runResult ?? null
  );
  const [loading,   setLoading]   = useState(!data);  // skip load if we already have data
  const [rerunning, setRerunning] = useState(false);
  const [error,     setError]     = useState('');

  // ── 1a. Data loading ───────────────────────────────────────
  useEffect(() => {
    if (data) return;   // already have results from navigation state

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        // 2. Try fetching existing results
        const res = await underwritingApi.getResults(appId);
        if (!cancelled) setData(res);
      } catch (fetchErr: any) {
        // 3. If 404, auto-trigger run once then redirect back here
        const is404 =
          fetchErr?.response?.status === 404 ||
          fetchErr?.message?.includes('404') ||
          fetchErr?.message?.toLowerCase().includes('not found');

        if (is404 && !cancelled) {
          try {
            const runRes = await underwritingApi.run(appId);
            if (!cancelled) setData(runRes);
          } catch (runErr: any) {
            if (!cancelled)
              setError(runErr?.message ?? 'Underwriting failed. Please try again.');
          }
        } else {
          if (!cancelled)
            setError(fetchErr?.message ?? 'Failed to load results.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [appId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1b. Re-run ─────────────────────────────────────────────
  const rerun = async () => {
    setRerunning(true);
    setError('');
    try {
      const res = await underwritingApi.run(appId);
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? 'Re-run failed. Please try again.');
    } finally {
      setRerunning(false);
    }
  };

  // ── 1c. Render ─────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-zinc-600 font-medium">Running underwriting…</p>
        <p className="text-zinc-400 text-sm mt-1">Evaluating all lender programs</p>
      </div>
    </div>
  );

  if (error && !data) return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Underwriting Error</p>
          <p className="text-sm mt-0.5">{error}</p>
          <button
            onClick={rerun}
            className="mt-3 text-sm font-semibold underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  const eligible   = data.results.filter(r => r.status === 'eligible');
  const ineligible = data.results.filter(r => r.status !== 'eligible');

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/applications"
            className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to applications
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">Underwriting Results</h1>
          <p className="text-zinc-600 mt-1">
            Application #{id} · {data.total_lenders_checked} lenders evaluated
          </p>
          {error && (
            <p className="text-amber-600 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />{error}
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={rerun} loading={rerunning}>
          {rerunning
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Re-running…</>
            : <><RefreshCw className="w-4 h-4" /> Re-run</>
          }
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="text-center">
          <Building2 className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-zinc-900">{data.total_lenders_checked}</div>
          <p className="text-sm text-zinc-500">Lenders Checked</p>
        </Card>
        <Card className="text-center border-emerald-200 bg-emerald-50">
          <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-emerald-700">{data.eligible_count}</div>
          <p className="text-sm text-emerald-600">Eligible</p>
        </Card>
        <Card className="text-center border-red-200 bg-red-50">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-red-600">{data.ineligible_count}</div>
          <p className="text-sm text-red-500">Ineligible</p>
        </Card>
      </div>

      {/* Eligible lenders */}
      {eligible.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Eligible Lenders — Ranked by Fit Score
          </h2>
          <div className="space-y-3">
            {eligible.map((r, i) => (
              <LenderMatchCard key={r.id} result={r} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {eligible.length === 0 && (
        <Card className="text-center py-12 mb-8 bg-amber-50 border-amber-200">
          <XCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-900">No Eligible Lenders Found</h3>
          <p className="text-zinc-600 mt-1">
            This application does not meet any lender's current criteria.
          </p>
          <p className="text-sm text-zinc-500 mt-2">
            Review the ineligible lenders below to understand what's needed.
          </p>
        </Card>
      )}

      {/* Ineligible lenders */}
      {ineligible.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Ineligible Lenders
          </h2>
          <div className="space-y-3">
            {ineligible.map(r => (
              <LenderMatchCard key={r.id} result={r} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

// endregion