// ============================================================
// App — Router + Layout
//
// TABLE OF CONTENTS
//   1.  Imports
//   2.  navItems       — route config for Nav links
//   3.  Nav component  — sticky top bar with logo and nav links
//   4.  App component  — BrowserRouter, layout shell, all routes
// ============================================================

import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import DashboardPage          from './pages/DashboardPage';
import ApplicationFormPage    from './pages/ApplicationFormPage';
import ApplicationsListPage   from './pages/ApplicationsListPage';
import ResultsPage            from './pages/ResultsPage';
import ApplicationDetailPage  from './pages/ApplicationDetailPage';
import LendersPage            from './pages/LendersPage';


// region ── 2. navItems ───────────────────────────────────────
//
// Single source of truth for top-nav routes.
// exact=true on Dashboard prevents it matching every sub-route.
// ─────────────────────────────────────────────────────────────

const navItems = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard, exact: true  },
  { to: '/applications', label: 'Applications', icon: FileText,        exact: false },
  { to: '/lenders',      label: 'Lenders',      icon: Building2,       exact: false },
];

// endregion


// region ── 3. Nav component ──────────────────────────────────
//
// Sticky top bar — logo left, nav links right.
// Active link gets emerald highlight via NavLink isActive prop.
// ─────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <span className="font-semibold text-zinc-900 font-sans">Kaaj</span>
          <span className="text-zinc-400 text-sm">· Lender Matching</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

      </div>
    </nav>
  );
}

// endregion


// region ── 4. App component ──────────────────────────────────
//
// Root component — wraps everything in BrowserRouter.
// Layout: Nav (sticky) + <main> with all page routes.
// ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-50 font-sans">
        <Nav />
        <main>
          <Routes>
            <Route path="/"                  element={<DashboardPage />}         />
            <Route path="/applications"      element={<ApplicationsListPage />}  />
            <Route path="/applications/new"  element={<ApplicationFormPage />}   />
            <Route path="/results/:id"       element={<ResultsPage />}           />
            <Route path="/applications/:id"  element={<ApplicationDetailPage />} />
            <Route path="/lenders"           element={<LendersPage />}           />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

// endregion