import '@testing-library/jest-dom/vitest';

// ── IntersectionObserver mock ──────────────────────────────────
// jsdom doesn't implement IntersectionObserver; PageTOC uses it.
// Provide a no-op stub so component renders without throwing.
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe()   {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

// Also mock scrollTo — jsdom doesn't support it; ApplicationFormPage calls it
window.HTMLElement.prototype.scrollTo = () => {};