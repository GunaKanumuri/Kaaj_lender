// ============================================================
// DASHBOARD / HOME PAGE
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Building2, TrendingUp, ArrowRight } from 'lucide-react';
import { applicationsApi } from '../api/applications';
import { lendersApi } from '../api/lenders';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { Application, Lender } from '../types';

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    applicationsApi.list().then(setApps);
    lendersApi.list().then(setLenders);
  }, []);

  const completed = apps.filter(a => a.status === 'completed').length;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-900">
          Lender Matching Platform
        </h1>
        <p className="text-zinc-600 mt-2 text-lg">
          Submit a loan application to instantly evaluate eligibility across {lenders.length} lenders.
        </p>
        <div className="mt-5">
          <Button size="lg" onClick={() => navigate('/applications/new')}>
            <Plus className="w-5 h-5" /> New Application
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900">{lenders.length}</div>
            <p className="text-sm text-zinc-500">Active Lenders</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900">{apps.length}</div>
            <p className="text-sm text-zinc-500">Applications</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900">{completed}</div>
            <p className="text-sm text-zinc-500">Evaluated</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent applications */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-zinc-900">Recent Applications</h2>
            <button onClick={() => navigate('/applications')} className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {apps.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-zinc-500 text-sm">No applications yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {apps.slice(0, 5).map(app => (
                <div key={app.id}
                  className="bg-white border border-zinc-200 rounded-lg p-3 flex items-center gap-3 hover:shadow-sm cursor-pointer transition-shadow"
                  onClick={() => app.status === 'completed' ? navigate(`/results/${app.id}`) : null}
                >
                  <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-zinc-900 truncate">
                      {app.business?.business_name || `App #${app.id}`}
                    </p>
                    <p className="text-xs text-zinc-500">
                      ${app.loan_request?.amount?.toLocaleString() ?? '—'}
                    </p>
                  </div>
                  <Badge variant={app.status === 'completed' ? 'success' : 'neutral'} size="sm">
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lenders overview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-zinc-900">Lender Overview</h2>
            <button onClick={() => navigate('/lenders')} className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {lenders.slice(0, 5).map(l => (
              <div key={l.id} className="bg-white border border-zinc-200 rounded-lg p-3 flex items-center gap-3">
                <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-zinc-900">{l.name}</p>
                  <p className="text-xs text-zinc-500">{l.programs.length} programs</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
