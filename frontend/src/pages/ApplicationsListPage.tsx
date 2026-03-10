// ============================================================
// APPLICATIONS LIST PAGE
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Clock, CheckCircle, ChevronRight, Trash2, Play, Loader2 } from 'lucide-react';
import { applicationsApi } from '../api/applications';
import { underwritingApi } from '../api/underwriting';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import type { Application } from '../types';

const statusBadge = (status: string) => {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>;
  if (status === 'draft') return <Badge variant="neutral">Draft</Badge>;
  if (status === 'processing') return <Badge variant="info">Processing...</Badge>;
  return <Badge variant="info">{status}</Badge>;
};

export default function ApplicationsListPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    applicationsApi.list().then(setApps).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this application?')) return;
    await applicationsApi.delete(id);
    setApps(apps.filter(a => a.id !== id));
  };

  const handleRunUnderwriting = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRunningId(id);
    setErrorId(null);
    try {
      await underwritingApi.run(id);
      // Mark as completed locally so button updates immediately
      setApps(prev =>
        prev.map(a => a.id === id ? { ...a, status: 'completed' } : a)
      );
      navigate(`/results/${id}`);
    } catch {
      setErrorId(id);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Loan Applications</h1>
          <p className="text-zinc-600 mt-1">{apps.length} application{apps.length !== 1 ? 's' : ''} total</p>
        </div>
        <Button onClick={() => navigate('/applications/new')}>
          <Plus className="w-4 h-4" /> New Application
        </Button>
      </div>

      {loading && <div className="text-center py-16 text-zinc-500">Loading...</div>}

      {!loading && apps.length === 0 && (
        <Card className="text-center py-16">
          <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-900">No Applications Yet</h3>
          <p className="text-zinc-600 mt-1 mb-4">Create your first loan application to find matching lenders.</p>
          <Button onClick={() => navigate('/applications/new')}>
            <Plus className="w-4 h-4" /> Create Application
          </Button>
        </Card>
      )}

      {!loading && apps.length > 0 && (
        <div className="space-y-3">
          {apps.map(app => (
            <div
              key={app.id}
              onClick={() => navigate(`/applications/${app.id}`)}
              className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-4 transition-shadow hover:shadow-md cursor-pointer"
            >
              {/* Icon */}
              <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-zinc-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900">
                    {app.business?.business_name || `Application #${app.id}`}
                  </span>
                  {statusBadge(app.status)}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500">
                  {app.business?.industry && <span>{app.business.industry}</span>}
                  {app.business?.state && <span>{app.business.state}</span>}
                  {app.loan_request?.amount && (
                    <span>${app.loan_request.amount.toLocaleString()}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(app.created_at).toLocaleDateString()}
                  </span>
                </div>
                {errorId === app.id && (
                  <p className="text-xs text-red-500 mt-1">Underwriting failed — please try again.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {app.status === 'completed' ? (
                  <>
                    {/* Re-run button */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => handleRunUnderwriting(app.id, e)}
                      disabled={runningId === app.id}
                    >
                      {runningId === app.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Play className="w-4 h-4" />}
                      Re-run
                    </Button>
                    {/* View Results button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/results/${app.id}`)}
                    >
                      View Results <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  // Run Underwriting — primary CTA for new applications
                  <Button
                    size="sm"
                    onClick={(e) => handleRunUnderwriting(app.id, e)}
                    disabled={runningId === app.id}
                  >
                    {runningId === app.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
                    ) : (
                      <><Play className="w-4 h-4" /> Run Underwriting</>
                    )}
                  </Button>
                )}

                <button
                  onClick={(e) => handleDelete(app.id, e)}
                  className="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}