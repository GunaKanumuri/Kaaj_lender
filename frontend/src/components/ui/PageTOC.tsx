// ============================================================
// PageTOC — sticky "On this page" rail with IntersectionObserver
//
// TABLE OF CONTENTS
//   1.  TocSection type
//   2.  useActiveSection hook   — IntersectionObserver, no scroll listeners
//   3.  PageTOC component       — renders the nav rail
//   4.  PageLayout component    — two-column shell (content | TOC)
//
// HOW TO ADD A TOC TO A PAGE
//   1. Define a const TOC: TocSection[] with { id, label } entries.
//   2. Wrap page JSX in <PageLayout sections={TOC}>.
//   3. Tag each content block with the matching id:
//        <section id="stats-summary" ...>
//   The active item tracks scroll via IntersectionObserver (no jank).
//   The rail is hidden below 1200 px — mobile/tablet are unaffected.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';


// region ── 1. TocSection type ────────────────────────────────

export interface TocSection {
  /** Must match the `id` attribute on the corresponding <section> element. */
  id:      string;
  label:   string;
  /** Visually indent — use for sub-sections within a page area. */
  indent?: boolean;
}

// endregion


// region ── 2. useActiveSection hook ──────────────────────────

/**
 * Returns the id of the section currently most visible in the viewport.
 *
 * Strategy:
 *   1. Keep a Set of ids currently intersecting the "active zone"
 *      (top 60 % of viewport, below the 56 px sticky nav).
 *   2. Walk ids in document order — the first intersecting id wins.
 *   3. If nothing intersects, fall back to the last section whose top
 *      has scrolled above the viewport midpoint.
 */
export function useActiveSection(ids: readonly string[]): string {
  const [active, setActive]   = useState<string>(ids[0] ?? '');
  const visibleRef            = useRef(new Set<string>());

  useEffect(() => {
    if (ids.length === 0) return;
    visibleRef.current.clear();

    const pick = () => {
      // 1. First intersecting id in document order
      for (const id of ids) {
        if (visibleRef.current.has(id)) { setActive(id); return; }
      }
      // 2. Fallback: last section whose top has passed mid-viewport
      const mid  = window.scrollY + window.innerHeight * 0.5;
      let   best = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= mid) best = id;
      }
      setActive(best);
    };

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e =>
          e.isIntersecting
            ? visibleRef.current.add(e.target.id)
            : visibleRef.current.delete(e.target.id),
        );
        pick();
      },
      // rootMargin: exclude the 56 px sticky nav at top, clip bottom 40 %
      { rootMargin: '-56px 0px -40% 0px', threshold: 0 },
    );

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  return active;
}

// endregion


// region ── 3. PageTOC component ──────────────────────────────

interface PageTOCProps { sections: readonly TocSection[] }

export function PageTOC({ sections }: PageTOCProps) {
  const ids    = sections.map(s => s.id);
  const active = useActiveSection(ids);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // 56 px sticky nav + 8 px breathing room
    window.scrollTo({
      top:      el.getBoundingClientRect().top + window.scrollY - 64,
      behavior: 'smooth',
    });
  };

  return (
    <nav aria-label="On this page" className="toc-root">
      <p className="toc-heading">On this page</p>
      <ol className="toc-list">
        {sections.map(s => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => scrollTo(s.id)}
                aria-current={isActive ? 'location' : undefined}
                className={clsx(
                  'toc-item',
                  s.indent && 'toc-item--indent',
                  isActive ? 'toc-item--active' : 'toc-item--idle',
                )}
              >
                <span className={clsx('toc-pip', isActive ? 'toc-pip--on' : 'toc-pip--off')} />
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// endregion


// region ── 4. PageLayout component ───────────────────────────

/**
 * Two-column shell:
 *   Left  → main content (scrollable)
 *   Right → sticky TOC rail (hidden < 1200 px via CSS)
 *
 * The actual .toc-root, .page-shell, .page-content, .page-toc-rail
 * classes are defined in index.css @layer components.
 */
interface PageLayoutProps {
  sections:      readonly TocSection[];
  children:      React.ReactNode;
  /** Inner max-width of the content column only (default 896 px). */
  contentWidth?: number;
}

export function PageLayout({ sections, children, contentWidth = 896 }: PageLayoutProps) {
  return (
    <div className="page-shell">
      <div className="page-content" style={{ maxWidth: contentWidth }}>
        {children}
      </div>
      <aside className="page-toc-rail">
        <PageTOC sections={sections} />
      </aside>
    </div>
  );
}

// endregion