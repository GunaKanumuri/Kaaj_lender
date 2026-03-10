// ============================================================
// RESULTS PAGE — Shows underwriting results for an application
// ============================================================

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, RefreshCw, Building2 } from 'lucide-react';
import { underwritingApi } from '../api/underwriting';
import { LenderMatchCard } from '../components/domain/LenderMatchCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { UnderwritingRunResponse } from '../types';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UnderwritingRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState('');

  const fetchResults = async () => {
    try {
      const res = await underwritingApi.getResults(Number(id));
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const rerun = async () => {
    setRerunning(true);
    try {
      const res = await underwritingApi.run(Number(id));
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRerunning(false);
    }
  };

  useEffect(() => { fetchResults(); }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-zinc-600">Loading results...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="p-4 bg-red-50 rounded-lg text-red-700">{error}</div>
    </div>
  );

  if (!data) return null;

  const eligible = data.results.filter(r => r.status === 'eligible');
  const ineligible = data.results.filter(r => r.status !== 'eligible');

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/applications" className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to applications
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">Underwriting Results</h1>
          <p className="text-zinc-600 mt-1">Application #{id} · {data.total_lenders_checked} lenders evaluated</p>
        </div>
        <Button variant="secondary" size="sm" onClick={rerun} loading={rerunning}>
          <RefreshCw className="w-4 h-4" /> Re-run
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
          <p className="text-zinc-600 mt-1">This application does not meet any lender's current criteria.</p>
          <p className="text-sm text-zinc-500 mt-2">Review the ineligible lenders below to understand what's needed.</p>
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
