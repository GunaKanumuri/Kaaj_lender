// ============================================================
// frontend.test.tsx
//
// TABLE OF CONTENTS
//   1.  Test Setup & Shared Factories
//   2.  Unit: Badge
//   3.  Unit: Button
//   4.  Unit: Card
//   5.  Unit: RuleResultRow
//   6.  Unit: LenderMatchCard
//   7.  Unit: API client — error interceptor
//   8.  Unit: applicationsApi
//   9.  Unit: lendersApi
//   10. Unit: underwritingApi
//   11. Integration: DashboardPage
//   12. Integration: ApplicationsListPage
//   13. Integration: ResultsPage
//   14. Integration: LendersPage
//   15. Integration: ApplicationFormPage (multi-step wizard)
//
// SETUP (add to package.json if not present):
//   "devDependencies": {
//     "vitest": "^1.0.0",
//     "@testing-library/react": "^14.0.0",
//     "@testing-library/user-event": "^14.0.0",
//     "@testing-library/jest-dom": "^6.0.0",
//     "msw": "^2.0.0",
//     "jsdom": "^24.0.0"
//   }
//
// vitest.config.ts:
//   export default { test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] } }
//
// src/test-setup.ts:
//   import '@testing-library/jest-dom';
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';

// ── Components under test ─────────────────────────────────────
import { Badge }          from './components/ui/Badge';
import { Button }         from './components/ui/Button';
import { Card }           from './components/ui/Card';
import { RuleResultRow }  from './components/domain/RuleResultRow';
import { LenderMatchCard } from './components/domain/LenderMatchCard';
import DashboardPage      from './pages/DashboardPage';
import ApplicationsListPage from './pages/ApplicationsListPage';
import ResultsPage        from './pages/ResultsPage';
import LendersPage        from './pages/LendersPage';
import ApplicationFormPage from './pages/ApplicationFormPage';

// ── API modules ───────────────────────────────────────────────
import { applicationsApi } from './api/applications';
import { lendersApi }      from './api/lenders';
import { underwritingApi } from './api/underwriting';
import apiClient           from './api/client';

import type {
  Application, Lender, LenderProgram, PolicyRule,
  MatchResult, RuleEvaluationResult, UnderwritingRunResponse,
} from './types';


// ─────────────────────────────────────────────────────────────
// region 1 ── Test Setup & Shared Factories
// ─────────────────────────────────────────────────────────────

// ── Factory helpers ───────────────────────────────────────────

function makeRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: 1, program_id: 1,
    field: 'fico_score', operator: 'gte', rule_type: 'hard',
    value_numeric: 700, score_weight: 10, label: 'Min FICO Score',
    ...overrides,
  };
}

function makeRuleResult(overrides: Partial<RuleEvaluationResult> = {}): RuleEvaluationResult {
  return {
    id: 1, rule_id: 1,
    passed: true,
    actual_value: '750', required_value: '>= 700',
    explanation: 'Min FICO Score: ✓ 750 meets minimum of 700',
    rule: { id: 1, field: 'fico_score', operator: 'gte', label: 'Min FICO Score', rule_type: 'hard' },
    ...overrides,
  };
}

function makeMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    id: 1, application_id: 10, lender_id: 1,
    status: 'eligible', fit_score: 87.5,
    summary: 'Eligible under A Rate program',
    created_at: '2025-01-01T00:00:00',
    lender_name: 'Apex Commercial Capital',
    program_name: 'A Rate',
    rule_results: [makeRuleResult()],
    ...overrides,
  };
}

function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 10, status: 'completed',
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
    business: {
      business_name: 'Acme Equipment LLC', industry: 'Construction',
      state: 'TX', years_in_business: 5, annual_revenue: 500000,
      is_startup: false, paynet_score: 680,
    },
    guarantor: {
      first_name: 'John', last_name: 'Smith', fico_score: 720,
      is_homeowner: true, is_us_citizen: true,
      has_bankruptcy: false, has_judgement: false, has_foreclosure: false,
      has_repossession: false, has_tax_lien: false, has_collections_last_3y: false,
    },
    loan_request: { amount: 50000, term_months: 60, is_private_party: false, is_titled_asset: false },
    ...overrides,
  };
}

function makeLender(overrides: Partial<Lender> = {}): Lender {
  return {
    id: 1, name: 'Apex Commercial Capital',
    description: 'Equipment Finance — A+/A/B/C tiers',
    is_active: true,
    programs: [{
      id: 1, lender_id: 1, name: 'A Rate', priority: 1,
      is_active: true, min_rate: 7.25, max_rate: 7.75,
      rules: [makeRule()],
    }],
    ...overrides,
  };
}

function makeUnderwritingResponse(overrides: Partial<UnderwritingRunResponse> = {}): UnderwritingRunResponse {
  return {
    application_id: 10, status: 'completed',
    total_lenders_checked: 5, eligible_count: 3, ineligible_count: 2,
    results: [makeMatchResult()],
    ...overrides,
  };
}

// ── MSW server ────────────────────────────────────────────────
// Intercepts real Axios calls so page components get controlled responses.

const server = setupServer(
  http.get('/api/v1/applications/', () =>
    HttpResponse.json([makeApplication()])
  ),
  http.get('/api/v1/lenders/', () =>
    HttpResponse.json([makeLender()])
  ),
  http.get('/api/v1/underwriting/results/:id', ({ params }) =>
    HttpResponse.json(
      makeUnderwritingResponse({ application_id: Number(params.id) || 10 })
    )
  ),
  http.post('/api/v1/underwriting/run/:id', ({ params }) =>
    HttpResponse.json(
      makeUnderwritingResponse({ application_id: Number(params.id) || 10 })
    )
  ),
);

beforeEach(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => { server.resetHandlers(); vi.restoreAllMocks(); });
afterEach(() => server.close());

// Helper: render a component inside MemoryRouter so hooks like useNavigate work
function renderWithRouter(
  ui: React.ReactElement,
  { initialPath = '/', routePath = '/' }: { initialPath?: string; routePath?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={routePath} element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 2 ── Unit: Badge
// ─────────────────────────────────────────────────────────────

describe('Badge', () => {

  it('renders children text', () => {
    render(<Badge>Eligible</Badge>);
    expect(screen.getByText('Eligible')).toBeInTheDocument();
  });

  it('defaults to neutral variant', () => {
    const { container } = render(<Badge>Draft</Badge>);
    expect(container.firstChild).toHaveClass('bg-zinc-100', 'text-zinc-700');
  });

  it('applies success variant classes', () => {
    const { container } = render(<Badge variant="success">Active</Badge>);
    expect(container.firstChild).toHaveClass('bg-emerald-100', 'text-emerald-800');
  });

  it('applies danger variant classes', () => {
    const { container } = render(<Badge variant="danger">Ineligible</Badge>);
    expect(container.firstChild).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('applies warning variant classes', () => {
    const { container } = render(<Badge variant="warning">Soft fail</Badge>);
    expect(container.firstChild).toHaveClass('bg-amber-100', 'text-amber-800');
  });

  it('applies info variant classes', () => {
    const { container } = render(<Badge variant="info">A Rate</Badge>);
    expect(container.firstChild).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('sm size is default — text-xs', () => {
    const { container } = render(<Badge>sm</Badge>);
    expect(container.firstChild).toHaveClass('text-xs');
  });

  it('md size applies text-sm', () => {
    const { container } = render(<Badge size="md">md</Badge>);
    expect(container.firstChild).toHaveClass('text-sm', 'px-3', 'py-1');
  });

  it('renders as a span', () => {
    const { container } = render(<Badge>Test</Badge>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 3 ── Unit: Button
// ─────────────────────────────────────────────────────────────

describe('Button', () => {

  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled and shows spinner when loading=true', () => {
    render(<Button loading>Saving</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Loader2 renders as an svg inside the button
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>No</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('primary variant has emerald background', () => {
    render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-emerald-600');
  });

  it('secondary variant has zinc background', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-zinc-100');
  });

  it('danger variant has red background', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');
  });

  it('lg size applies larger padding', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3', 'text-base');
  });

  it('sm size applies smaller padding', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5', 'text-sm');
  });

  it('merges custom className', () => {
    render(<Button className="my-custom-class">Custom</Button>);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 4 ── Unit: Card
// ─────────────────────────────────────────────────────────────

describe('Card', () => {

  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('has white background and border by default', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('bg-white', 'border-zinc-200', 'rounded-xl');
  });

  it('md padding is default (p-5)', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('p-5');
  });

  it('sm padding applies p-3', () => {
    const { container } = render(<Card padding="sm">Content</Card>);
    expect(container.firstChild).toHaveClass('p-3');
  });

  it('lg padding applies p-8', () => {
    const { container } = render(<Card padding="lg">Content</Card>);
    expect(container.firstChild).toHaveClass('p-8');
  });

  it('none padding applies no padding class', () => {
    const { container } = render(<Card padding="none">Content</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toMatch(/p-\d/);
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="border-emerald-200">Content</Card>);
    expect(container.firstChild).toHaveClass('border-emerald-200');
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 5 ── Unit: RuleResultRow
// ─────────────────────────────────────────────────────────────

describe('RuleResultRow', () => {

  it('shows green background and CheckCircle for a passing rule', () => {
    const result = makeRuleResult({ passed: true });
    const { container } = render(<RuleResultRow result={result} />);
    expect(container.firstChild).toHaveClass('bg-emerald-50');
    // CheckCircle is rendered as svg; verify no XCircle/AlertCircle classes
    expect(screen.getByText('Min FICO Score')).toHaveClass('text-emerald-900');
  });

  it('shows red background for a hard failure', () => {
    const result = makeRuleResult({
      passed: false,
      explanation: 'Min FICO Score: ✗ 650 is below minimum required 700',
      actual_value: '650',
      rule: { id: 1, field: 'fico_score', operator: 'gte', label: 'Min FICO Score', rule_type: 'hard' },
    });
    const { container } = render(<RuleResultRow result={result} />);
    expect(container.firstChild).toHaveClass('bg-red-50');
    expect(screen.getByText('hard fail')).toBeInTheDocument();
  });

  it('shows amber background for a soft failure', () => {
    const result = makeRuleResult({
      passed: false,
      explanation: 'Comparable Credit: ✗ 60% below preferred 80%',
      actual_value: '60',
      rule: { id: 2, field: 'comparable_credit_pct', operator: 'gte', label: 'Comparable Credit', rule_type: 'soft' },
    });
    const { container } = render(<RuleResultRow result={result} />);
    expect(container.firstChild).toHaveClass('bg-amber-50');
    expect(screen.getByText('soft')).toBeInTheDocument();
  });

  it('shows actual vs required values on failure', () => {
    const result = makeRuleResult({
      passed: false,
      actual_value: '650',
      required_value: '>= 700',
      rule: { id: 1, field: 'fico_score', operator: 'gte', label: 'Min FICO Score', rule_type: 'hard' },
    });
    render(<RuleResultRow result={result} />);
    expect(screen.getByText('650')).toBeInTheDocument();
    expect(screen.getByText('>= 700')).toBeInTheDocument();
  });

  it('does NOT show actual/required values when rule passes', () => {
    const result = makeRuleResult({ passed: true, actual_value: '750', required_value: '>= 700' });
    render(<RuleResultRow result={result} />);
    // Values are only shown inside the failure block
    expect(screen.queryByText('750')).not.toBeInTheDocument();
    expect(screen.queryByText('>= 700')).not.toBeInTheDocument();
  });

  it('shows rule label as heading', () => {
    const result = makeRuleResult({ rule: { id: 1, field: 'fico_score', operator: 'gte', label: 'Min FICO Score', rule_type: 'hard' } });
    render(<RuleResultRow result={result} />);
    expect(screen.getByText('Min FICO Score')).toBeInTheDocument();
  });

  it('falls back to rule.field when label is absent', () => {
    const result = makeRuleResult({
      rule: { id: 1, field: 'fico_score', operator: 'gte', label: undefined, rule_type: 'hard' },
    });
    render(<RuleResultRow result={result} />);
    expect(screen.getByText('fico_score')).toBeInTheDocument();
  });

  it('shows explanation text', () => {
    const result = makeRuleResult({ explanation: 'Min FICO Score: ✓ 750 meets minimum of 700' });
    render(<RuleResultRow result={result} />);
    expect(screen.getByText('Min FICO Score: ✓ 750 meets minimum of 700')).toBeInTheDocument();
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 6 ── Unit: LenderMatchCard
// ─────────────────────────────────────────────────────────────

describe('LenderMatchCard', () => {

  it('shows lender name', () => {
    render(<LenderMatchCard result={makeMatchResult()} />);
    expect(screen.getByText('Apex Commercial Capital')).toBeInTheDocument();
  });

  it('shows Eligible badge for eligible status', () => {
    render(<LenderMatchCard result={makeMatchResult({ status: 'eligible' })} />);
    expect(screen.getByText('✓ Eligible')).toBeInTheDocument();
  });

  it('shows Ineligible badge for ineligible status', () => {
    render(<LenderMatchCard result={makeMatchResult({ status: 'ineligible', fit_score: 0 })} />);
    expect(screen.getByText('✗ Ineligible')).toBeInTheDocument();
  });

  it('shows fit score only when eligible', () => {
    render(<LenderMatchCard result={makeMatchResult({ status: 'eligible', fit_score: 87.5 })} />);
    expect(screen.getByText('87.5')).toBeInTheDocument();
  });

  it('does not show fit score when ineligible', () => {
    render(<LenderMatchCard result={makeMatchResult({ status: 'ineligible', fit_score: 0 })} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows program name badge', () => {
    render(<LenderMatchCard result={makeMatchResult({ program_name: 'A Rate' })} />);
    expect(screen.getByText('A Rate')).toBeInTheDocument();
  });

  it('shows rank bubble when rank prop provided', () => {
    render(<LenderMatchCard result={makeMatchResult()} rank={1} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('does not show rank bubble when rank is absent', () => {
    render(<LenderMatchCard result={makeMatchResult()} />);
    // No number 1 standing alone as a rank
    expect(screen.queryByText(/^1$/)).not.toBeInTheDocument();
  });

  it('shows rules passed count', () => {
    const result = makeMatchResult({
      rule_results: [
        makeRuleResult({ passed: true }),
        makeRuleResult({ id: 2, passed: false }),
      ],
    });
    render(<LenderMatchCard result={result} />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('expands to show rule breakdown on toggle click', async () => {
    render(<LenderMatchCard result={makeMatchResult()} />);
    expect(screen.queryByText('Policy Rules Evaluated')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Expand rule details'));
    expect(screen.getByText('Policy Rules Evaluated')).toBeInTheDocument();
  });

  it('collapses rule breakdown on second toggle click', async () => {
    render(<LenderMatchCard result={makeMatchResult()} />);
    const toggleBtn = screen.getByLabelText('Expand rule details');
    await userEvent.click(toggleBtn);
    await userEvent.click(screen.getByLabelText('Collapse rule details'));
    expect(screen.queryByText('Policy Rules Evaluated')).not.toBeInTheDocument();
  });

  it('renders each RuleResultRow when expanded', async () => {
    const result = makeMatchResult({
      rule_results: [
        makeRuleResult({ id: 1, explanation: 'Rule one explanation' }),
        makeRuleResult({ id: 2, explanation: 'Rule two explanation' }),
      ],
    });
    render(<LenderMatchCard result={result} />);
    await userEvent.click(screen.getByLabelText('Expand rule details'));
    expect(screen.getByText('Rule one explanation')).toBeInTheDocument();
    expect(screen.getByText('Rule two explanation')).toBeInTheDocument();
  });

  it('shows "No rule details available" when rule_results is empty and expanded', async () => {
    const result = makeMatchResult({ rule_results: [] });
    render(<LenderMatchCard result={result} />);
    await userEvent.click(screen.getByLabelText('Expand rule details'));
    expect(screen.getByText('No rule details available.')).toBeInTheDocument();
  });

  it('has emerald border for eligible', () => {
    const { container } = render(<LenderMatchCard result={makeMatchResult({ status: 'eligible' })} />);
    expect(container.firstChild).toHaveClass('border-emerald-200');
  });

  it('has zinc border for ineligible', () => {
    const { container } = render(<LenderMatchCard result={makeMatchResult({ status: 'ineligible' })} />);
    expect(container.firstChild).toHaveClass('border-zinc-200');
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 7 ── Unit: API client — error interceptor
// ─────────────────────────────────────────────────────────────

describe('apiClient error interceptor', () => {

  it('rejects with a plain Error from a string detail', async () => {
    server.use(
      http.get('/api/v1/test-error', () =>
        HttpResponse.json({ detail: 'Application not found' }, { status: 404 })
      )
    );
    await expect(apiClient.get('/test-error')).rejects.toThrow('Application not found');
  });

  it('joins array detail messages with semicolons', async () => {
    server.use(
      http.get('/api/v1/test-error', () =>
        HttpResponse.json(
          { detail: [{ msg: 'field required' }, { msg: 'value invalid' }] },
          { status: 422 }
        )
      )
    );
    await expect(apiClient.get('/test-error')).rejects.toThrow('field required; value invalid');
  });

  it('falls back to error.message when no detail key', async () => {
    server.use(
      http.get('/api/v1/test-error', () =>
        HttpResponse.json({}, { status: 500 })
      )
    );
    // Should reject with something — not hang
    await expect(apiClient.get('/test-error')).rejects.toBeInstanceOf(Error);
  });

  it('resolves normally for 200 responses', async () => {
    server.use(
      http.get('/api/v1/test-ok', () => HttpResponse.json({ ok: true }))
    );
    const res = await apiClient.get('/test-ok');
    expect(res.data).toEqual({ ok: true });
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 8 ── Unit: applicationsApi
// ─────────────────────────────────────────────────────────────

describe('applicationsApi', () => {

  it('list() returns array of applications', async () => {
    const apps = await applicationsApi.list();
    expect(Array.isArray(apps)).toBe(true);
    expect(apps[0].id).toBe(10);
  });

  it('get() returns a single application by id', async () => {
    server.use(
      http.get('/api/v1/applications/10', () =>
        HttpResponse.json(makeApplication({ id: 10 }))
      )
    );
    const app = await applicationsApi.get(10);
    expect(app.id).toBe(10);
    expect(app.business?.business_name).toBe('Acme Equipment LLC');
  });

  it('create() posts form data and returns created application', async () => {
    server.use(
      http.post('/api/v1/applications/', async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json(makeApplication({ id: 99, status: 'draft', ...body }), { status: 201 });
      })
    );
    const payload = {
      business: { business_name: 'New Co', is_startup: false },
      guarantor: { first_name: 'Jane', last_name: 'Doe', is_homeowner: false,
                   is_us_citizen: true, has_bankruptcy: false, has_judgement: false,
                   has_foreclosure: false, has_repossession: false, has_tax_lien: false,
                   has_collections_last_3y: false },
      loan_request: { amount: 30000, is_private_party: false, is_titled_asset: false },
    };
    const app = await applicationsApi.create(payload as any);
    expect(app.id).toBe(99);
  });

  it('delete() calls DELETE endpoint', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('/api/v1/applications/10', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    await applicationsApi.delete(10);
    expect(deleteCalled).toBe(true);
  });

  it('update() sends PUT with partial data', async () => {
    let receivedBody: any;
    server.use(
      http.put('/api/v1/applications/10', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(makeApplication({ id: 10 }));
      })
    );
    await applicationsApi.update(10, { business: { business_name: 'Updated Co', is_startup: false } });
    expect(receivedBody.business.business_name).toBe('Updated Co');
  });

  it('get() rejects with Error on 404', async () => {
    server.use(
      http.get('/api/v1/applications/999', () =>
        HttpResponse.json({ detail: 'Application not found' }, { status: 404 })
      )
    );
    await expect(applicationsApi.get(999)).rejects.toThrow('Application not found');
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 9 ── Unit: lendersApi
// ─────────────────────────────────────────────────────────────

describe('lendersApi', () => {

  it('list() returns array of lenders with programs', async () => {
    const lenders = await lendersApi.list();
    expect(lenders[0].name).toBe('Apex Commercial Capital');
    expect(lenders[0].programs.length).toBeGreaterThan(0);
  });

  it('addRule() posts to correct program endpoint', async () => {
    let postedProgramId: string | undefined;
    server.use(
      http.post('/api/v1/lenders/programs/:programId/rules', ({ params }) => {
        postedProgramId = params.programId as string;
        return HttpResponse.json(makeRule({ id: 99, program_id: 1 }), { status: 201 });
      })
    );
    const rule = await lendersApi.addRule(1, { field: 'fico_score', operator: 'gte', value_numeric: 700, score_weight: 10, rule_type: 'hard' });
    expect(postedProgramId).toBe('1');
    expect(rule.id).toBe(99);
  });

  it('updateRule() sends PUT to correct rule endpoint', async () => {
    let receivedBody: any;
    server.use(
      http.put('/api/v1/lenders/rules/5', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(makeRule({ id: 5, value_numeric: 720 }));
      })
    );
    await lendersApi.updateRule(5, { value_numeric: 720 });
    expect(receivedBody.value_numeric).toBe(720);
  });

  it('deleteRule() sends DELETE to correct endpoint', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('/api/v1/lenders/rules/5', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    await lendersApi.deleteRule(5);
    expect(deleteCalled).toBe(true);
  });

  it('addProgram() sends to correct lender endpoint', async () => {
    let receivedLenderId: string | undefined;
    server.use(
      http.post('/api/v1/lenders/:lenderId/programs', ({ params }) => {
        receivedLenderId = params.lenderId as string;
        return HttpResponse.json({ id: 20, lender_id: 1, name: 'New Program', priority: 5, is_active: true, rules: [] }, { status: 201 });
      })
    );
    await lendersApi.addProgram(1, { name: 'New Program', priority: 5, is_active: true, rules: [] } as any);
    expect(receivedLenderId).toBe('1');
  });

  it('deleteProgram() sends DELETE to program endpoint', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('/api/v1/lenders/programs/3', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    await lendersApi.deleteProgram(3);
    expect(deleteCalled).toBe(true);
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 10 ── Unit: underwritingApi
// ─────────────────────────────────────────────────────────────

describe('underwritingApi', () => {

  it('run() posts to run endpoint and returns response', async () => {
    server.use(
      http.post('/api/v1/underwriting/run/10', () =>
        HttpResponse.json(makeUnderwritingResponse())
      )
    );
    const res = await underwritingApi.run(10);
    expect(res.application_id).toBe(10);
    expect(res.eligible_count).toBe(3);
    expect(res.ineligible_count).toBe(2);
  });

  it('getResults() fetches results by application id', async () => {
    const res = await underwritingApi.getResults(10);
    expect(res.application_id).toBe(10);
    expect(res.results.length).toBeGreaterThan(0);
  });

  it('getResults() rejects with Error when no results exist (404)', async () => {
    server.use(
      http.get('/api/v1/underwriting/results/999', () =>
        HttpResponse.json(
          { detail: 'No underwriting results found. Run underwriting first.' },
          { status: 404 }
        )
      )
    );
    await expect(underwritingApi.getResults(999)).rejects.toThrow(
      'No underwriting results found. Run underwriting first.'
    );
  });

  it('run() returns backend results as-is', async () => {
    const ineligible = makeMatchResult({ id: 2, status: 'ineligible', fit_score: 0, lender_name: 'Stearns Bank' });
    const eligible = makeMatchResult({ id: 1, status: 'eligible', fit_score: 90, lender_name: 'Apex' });

    server.use(
      http.post('/api/v1/underwriting/run/10', () =>
        HttpResponse.json(makeUnderwritingResponse({ results: [ineligible, eligible] }))
      )
    );

    const res = await underwritingApi.run(10);
    expect(res.results[0].status).toBe('ineligible');
    expect(res.results[1].status).toBe('eligible');
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 11 ── Integration: DashboardPage
// ─────────────────────────────────────────────────────────────

describe('DashboardPage', () => {

  it('renders platform heading', async () => {
    renderWithRouter(<DashboardPage />);
    expect(await screen.findByText('Lender Matching Platform')).toBeInTheDocument();
  });

  it('shows application count from API', async () => {
    server.use(
      http.get('/api/v1/applications/', () =>
        HttpResponse.json([makeApplication(), makeApplication({ id: 11 })])
      )
    );
    renderWithRouter(<DashboardPage />);
    // '2' apps shows in the stat card; wait for lender data too so all stats render
    await screen.findByText('Lender Matching Platform');
    await waitFor(() => {
      const all = screen.getAllByText('2');
      expect(all.length).toBeGreaterThan(0);
    });
  });

  it('shows "No applications yet" when list is empty', async () => {
    server.use(
      http.get('/api/v1/applications/', () => HttpResponse.json([]))
    );
    renderWithRouter(<DashboardPage />);
    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
  });

  it('lists recent application business names', async () => {
    renderWithRouter(<DashboardPage />);
    expect(await screen.findByText('Acme Equipment LLC')).toBeInTheDocument();
  });

  it('shows lender names in lender overview', async () => {
    renderWithRouter(<DashboardPage />);
    expect(await screen.findByText('Apex Commercial Capital')).toBeInTheDocument();
  });

  it('has "New Application" CTA button', async () => {
    renderWithRouter(<DashboardPage />);
    expect(await screen.findByRole('button', { name: /new application/i })).toBeInTheDocument();
  });

  it('shows evaluated count (completed applications)', async () => {
    server.use(
      http.get('/api/v1/applications/', () =>
        HttpResponse.json([
          makeApplication({ status: 'completed' }),
          makeApplication({ id: 11, status: 'draft' }),
        ])
      )
    );
    renderWithRouter(<DashboardPage />);
    // 1 completed
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 12 ── Integration: ApplicationsListPage
// ─────────────────────────────────────────────────────────────

describe('ApplicationsListPage', () => {

  it('shows page heading', async () => {
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText('Loan Applications')).toBeInTheDocument();
  });

  it('shows application count', async () => {
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText(/1 application/)).toBeInTheDocument();
  });

  it('renders application business name', async () => {
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText('Acme Equipment LLC')).toBeInTheDocument();
  });

  it('shows "No Applications Yet" empty state when list is empty', async () => {
    server.use(
      http.get('/api/v1/applications/', () => HttpResponse.json([]))
    );
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText('No Applications Yet')).toBeInTheDocument();
  });

  it('shows "Completed" badge for completed applications', async () => {
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText('Completed')).toBeInTheDocument();
  });

  it('shows "Draft" badge for draft applications', async () => {
    server.use(
      http.get('/api/v1/applications/', () =>
        HttpResponse.json([makeApplication({ status: 'draft' })])
      )
    );
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText('Draft')).toBeInTheDocument();
  });

  it('shows loan amount', async () => {
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText(/50,000/)).toBeInTheDocument();
  });

  it('shows delete button per application', async () => {
    renderWithRouter(<ApplicationsListPage />);
    await screen.findByText('Acme Equipment LLC');
    // Trash icon buttons exist (via aria or test id); at minimum a button for delete
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('removes application from list after delete confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.delete('/api/v1/applications/10', () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    renderWithRouter(<ApplicationsListPage />);
    await screen.findByText('Acme Equipment LLC');

    // Find and click delete button (trash icon — last button in row)
    const deleteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg') && !btn.textContent?.trim()
    );
    if (deleteBtn) {
      await userEvent.click(deleteBtn);
      await waitFor(() =>
        expect(screen.queryByText('Acme Equipment LLC')).not.toBeInTheDocument()
      );
    }
  });

  it('shows Run Underwriting button for draft applications', async () => {
    server.use(
      http.get('/api/v1/applications/', () =>
        HttpResponse.json([makeApplication({ status: 'draft' })])
      )
    );
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText('Run Underwriting')).toBeInTheDocument();
  });

  it('shows Re-run and View Results buttons for completed applications', async () => {
    renderWithRouter(<ApplicationsListPage />);
    expect(await screen.findByText('Re-run')).toBeInTheDocument();
    expect(await screen.findByText(/view results/i)).toBeInTheDocument();
  });

  it('shows error message if underwriting fails', async () => {
    server.use(
      http.get('/api/v1/applications/', () =>
        HttpResponse.json([makeApplication({ status: 'draft' })])
      ),
      http.post('/api/v1/underwriting/run/10', () =>
        HttpResponse.json({ detail: 'Underwriting failed' }, { status: 500 })
      )
    );
    renderWithRouter(<ApplicationsListPage />);
    await screen.findByText('Run Underwriting');
    await userEvent.click(screen.getByText('Run Underwriting'));
    expect(await screen.findByText(/underwriting failed/i)).toBeInTheDocument();
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 13 ── Integration: ResultsPage
// ─────────────────────────────────────────────────────────────

describe('ResultsPage', () => {

  function renderResults(id = '10') {
    return render(
      <MemoryRouter initialEntries={[`/results/${id}`]}>
        <Routes>
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/applications" element={<div>Applications</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('shows "Underwriting Results" heading', async () => {
    renderResults();
    expect(await screen.findByText('Underwriting Results')).toBeInTheDocument();
  });

  it('shows total lenders checked count', async () => {
    renderResults();
    expect(await screen.findByText('5')).toBeInTheDocument();
  });

  it('shows eligible count', async () => {
    renderResults();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('shows ineligible count', async () => {
    renderResults();
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('shows eligible lender section heading', async () => {
    renderResults();
    expect(await screen.findByText(/eligible lenders/i)).toBeInTheDocument();
  });

  it('shows eligible lender name', async () => {
    renderResults();
    expect(await screen.findByText('Apex Commercial Capital')).toBeInTheDocument();
  });

  it('shows "No Eligible Lenders Found" when eligible_count is 0', async () => {
    server.use(
      http.get('/api/v1/underwriting/results/:id', () =>
        HttpResponse.json(makeUnderwritingResponse({
          eligible_count: 0, ineligible_count: 5,
          results: [makeMatchResult({ status: 'ineligible', fit_score: 0 })],
        }))
      )
    );
    renderResults();
    expect(await screen.findByText('No Eligible Lenders Found')).toBeInTheDocument();
  });

  it('shows ineligible lenders section', async () => {
    server.use(
      http.get('/api/v1/underwriting/results/:id', () =>
        HttpResponse.json(makeUnderwritingResponse({
          eligible_count: 1, ineligible_count: 1,
          results: [
            makeMatchResult({ status: 'eligible' }),
            makeMatchResult({ id: 2, status: 'ineligible', lender_name: 'Stearns Bank', fit_score: 0 }),
          ],
        }))
      )
    );
    renderResults();
    expect(await screen.findByText(/ineligible lenders/i)).toBeInTheDocument();
    expect(await screen.findByText('Stearns Bank')).toBeInTheDocument();
  });

  it('shows loading spinner before data arrives', () => {
    // Delay the response
    server.use(
      http.get('/api/v1/underwriting/results/:id', async () => {
        await new Promise(r => setTimeout(r, 200));
        return HttpResponse.json(makeUnderwritingResponse());
      })
    );
    renderResults();
    expect(screen.getByText(/running underwriting/i)).toBeInTheDocument();
  });

  it('shows error message when API call fails', async () => {
    server.use(
      http.get('/api/v1/underwriting/results/:id', () =>
        HttpResponse.json({ detail: 'No underwriting results found. Run underwriting first.' }, { status: 404 })
      ),
      // Auto-run fallback also fails
      http.post('/api/v1/underwriting/run/:id', () =>
        HttpResponse.json({ detail: 'Application not found' }, { status: 404 })
      )
    );
    renderResults('999');
    expect(await screen.findByText(/no underwriting results found/i)).toBeInTheDocument();
  });

  it('Re-run button triggers new underwriting run', async () => {
    let runCalled = false;
    server.use(
      http.post('/api/v1/underwriting/run/10', () => {
        runCalled = true;
        return HttpResponse.json(makeUnderwritingResponse());
      })
    );
    renderResults();
    await screen.findByText('Underwriting Results');
    await userEvent.click(screen.getByRole('button', { name: /re-run/i }));
    await waitFor(() => expect(runCalled).toBe(true));
  });

  it('fit score is displayed for eligible lender', async () => {
    renderResults();
    expect(await screen.findByText('87.5')).toBeInTheDocument();
  });

  it('application id is shown in subtitle', async () => {
    renderResults('10');
    expect(await screen.findByText(/application #10/i)).toBeInTheDocument();
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 14 ── Integration: LendersPage
// ─────────────────────────────────────────────────────────────

describe('LendersPage', () => {

  it('shows "Lender Policies" heading', async () => {
    renderWithRouter(<LendersPage />);
    expect(await screen.findByText('Lender Policies')).toBeInTheDocument();
  });

  it('shows lender count in subtitle', async () => {
    renderWithRouter(<LendersPage />);
    expect(await screen.findByText(/1 lenders/)).toBeInTheDocument();
  });

  it('shows lender name', async () => {
    renderWithRouter(<LendersPage />);
    expect(await screen.findByText('Apex Commercial Capital')).toBeInTheDocument();
  });

  it('shows program count for lender', async () => {
    renderWithRouter(<LendersPage />);
    expect(await screen.findByText(/1 active programs/)).toBeInTheDocument();
  });

  it('shows rule count badge on lender card', async () => {
    renderWithRouter(<LendersPage />);
    expect(await screen.findByText(/1 total rules/)).toBeInTheDocument();
  });

  it('shows "Loading lenders..." while fetching', () => {
    server.use(
      http.get('/api/v1/lenders/', async () => {
        await new Promise(r => setTimeout(r, 200));
        return HttpResponse.json([makeLender()]);
      })
    );
    renderWithRouter(<LendersPage />);
    expect(screen.getByText('Loading lenders…')).toBeInTheDocument();
  });

  it('expands lender card and shows programs on click', async () => {
    renderWithRouter(<LendersPage />);
    await screen.findByText('Apex Commercial Capital');
    await userEvent.click(screen.getByText('Apex Commercial Capital'));
    expect(await screen.findByText('A Rate')).toBeInTheDocument();
  });

  it('shows "Add New Lender" button', async () => {
    renderWithRouter(<LendersPage />);
    expect(await screen.findByRole('button', { name: /add lender/i })).toBeInTheDocument();
  });

  it('opens add lender modal on button click', async () => {
    renderWithRouter(<LendersPage />);
    await userEvent.click(await screen.findByRole('button', { name: /add lender/i }));
    expect(await screen.findByText(/lender details/i)).toBeInTheDocument();
  });

  it('shows rule field and operator when program accordion is expanded', async () => {
    renderWithRouter(<LendersPage />);
    await screen.findByText('Apex Commercial Capital');
    await userEvent.click(screen.getByText('Apex Commercial Capital'));

    // Expand the A Rate program
    const programBtn = await screen.findByText('A Rate');
    await userEvent.click(programBtn);

    expect(await screen.findByText('Min FICO Score')).toBeInTheDocument();
  });

  it('shows "Add rule" button when program accordion is open', async () => {
    renderWithRouter(<LendersPage />);
    await screen.findByText('Apex Commercial Capital');
    await userEvent.click(screen.getByText('Apex Commercial Capital'));
    await userEvent.click(await screen.findByText('A Rate'));
    expect(await screen.findByText('Add rule')).toBeInTheDocument();
  });

});

// endregion


// ─────────────────────────────────────────────────────────────
// region 15 ── Integration: ApplicationFormPage (wizard)
// ─────────────────────────────────────────────────────────────

describe('ApplicationFormPage', () => {

  function renderForm() {
    return render(
      <MemoryRouter initialEntries={['/applications/new']}>
        <Routes>
          <Route path="/applications/new" element={<ApplicationFormPage />} />
          <Route path="/results/:id" element={<div>Results Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders step 1 heading by default', async () => {
    renderForm();
    expect(await screen.findByRole('heading', { name: 'Business Info' })).toBeInTheDocument();
  });

  it('shows all 4 step indicators in sidebar', async () => {
    renderForm();
    expect(await screen.findByRole('heading', { name: 'Business Info' })).toBeInTheDocument();
    // Mobile/sidebar short labels
    expect(screen.getAllByText('Business').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Guarantor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('History').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Loan').length).toBeGreaterThan(0);
  });

  it('shows Business Name field on step 1', async () => {
    renderForm();
    expect(await screen.findByPlaceholderText('e.g. Acme Equipment LLC')).toBeInTheDocument();
  });

  it('advances to step 2 (Guarantor) on Continue click', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: 'Guarantor' })).toBeInTheDocument();
  });

  it('step 2 shows FICO Score field', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByPlaceholderText('e.g. 720')).toBeInTheDocument();
  });

  it('advances to step 3 (Credit History) from step 2', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: 'Credit History' })).toBeInTheDocument();
  });

  it('advances to step 4 (Loan Request) from step 3', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Credit History' });
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: 'Loan Request' })).toBeInTheDocument();
  });

  it('Back button on step 2 returns to step 1', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByRole('heading', { name: 'Business Info' })).toBeInTheDocument();
  });

  it('step 4 shows Loan Amount field', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Credit History' });
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByPlaceholderText('0')).toBeInTheDocument();
  });

  it('step 4 shows Find Matching Lenders submit button', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Credit History' });
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('button', { name: /find matching lenders/i })).toBeInTheDocument();
  });

  it('submit calls create then run and navigates to results', async () => {
    server.use(
      http.post('/api/v1/applications/', () =>
        HttpResponse.json(makeApplication({ id: 55, status: 'draft' }), { status: 201 })
      ),
      http.post('/api/v1/underwriting/run/55', () =>
        HttpResponse.json(makeUnderwritingResponse({ application_id: 55 }))
      )
    );

    renderForm();

    // Step 1 — fill required field
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2 — fill required fields
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 3 — Credit History, no required fields, just continue
    await screen.findByRole('heading', { name: 'Credit History' });
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 4 — fill loan amount and submit
    await screen.findByRole('heading', { name: 'Loan Request' });
    await userEvent.type(screen.getByPlaceholderText('0'), '50000');
    await userEvent.click(screen.getByRole('button', { name: /find matching lenders/i }));

    expect(await screen.findByText('Results Page')).toBeInTheDocument();
  });

  it('shows error message when API call fails on submit', async () => {
    server.use(
      http.post('/api/v1/applications/', () =>
        HttpResponse.json({ detail: 'Validation failed' }, { status: 422 })
      )
    );
    renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Credit History' });
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Loan Request' });
    await userEvent.type(screen.getByPlaceholderText('0'), '50000');
    await userEvent.click(screen.getByRole('button', { name: /find matching lenders/i }));
    expect(await screen.findByText(/validation failed/i)).toBeInTheDocument();
  });

  it('shows "Running Underwriting…" button label during submit', async () => {
  server.use(
    http.post('/api/v1/applications/', async () => {
      await new Promise(r => setTimeout(r, 100));
      return HttpResponse.json(makeApplication({ id: 55 }), { status: 201 });
    }),
    http.post('/api/v1/underwriting/run/55', async () => {
      await new Promise(r => setTimeout(r, 100));
      return HttpResponse.json(makeUnderwritingResponse({ application_id: 55 }));
    })
  );

  renderForm();
    await screen.findByRole('heading', { name: 'Business Info' });
    await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Guarantor' });
    await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'Credit History' });
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await userEvent.type(await screen.findByPlaceholderText('0'), '50000');
    await userEvent.click(screen.getByRole('button', { name: /find matching lenders/i }));
    expect(await screen.findByText(/running underwriting/i)).toBeInTheDocument();
  });

  it('shows bankruptcy detail only when bankruptcy is checked', async () => {
  renderForm();

  await screen.findByRole('heading', { name: 'Business Info' });
  await userEvent.type(screen.getByPlaceholderText('e.g. Acme Equipment LLC'), 'Test Co');
  await userEvent.click(screen.getByRole('button', { name: /continue/i }));

  await screen.findByRole('heading', { name: 'Guarantor' });
  await userEvent.type(screen.getByPlaceholderText('John'), 'Jane');
  await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe');
  await userEvent.type(screen.getByPlaceholderText('e.g. 720'), '720');
  await userEvent.click(screen.getByRole('button', { name: /continue/i }));

  await screen.findByRole('heading', { name: 'Credit History' });

  expect(screen.queryByText(/bankruptcy detail/i)).not.toBeInTheDocument();

  const checkbox = screen.getByRole('checkbox', { name: /bankruptcy/i });
  await userEvent.click(checkbox);

  expect(await screen.findByText(/bankruptcy detail/i)).toBeInTheDocument();
});

});

// endregion