import type { ReactNode } from 'react';
import type { QStatus } from '../types';
import { STATUS_LABEL } from '../lib/examState';

export const CANDIDATE = 'Tiya Madan';
/** Personal note shown on the dashboard and results screen only, never during a timed test. */
export const ASPIRATION = 'Aspiring IIM Ahmedabad Student | CAT 2026';
export const MOTTO = 'Every question you solve brings you one step closer to the dream.';

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="site-header">
      <a href="#/" className="brand" aria-label="Go to dashboard">
        <span className="brand-title">TIYA MADAN | CAT 2026</span>
        <span className="brand-sub">VARC Examination Centre</span>
      </a>
      <nav className="site-nav">
        <a href="#/">Dashboard</a>
        <a href="#/progress">Performance</a>
        {right}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      This is a personal practice simulator for Tiya Madan. It is not an official CAT or IIM product and is not affiliated with or endorsed by them.
      Attempts are stored only in this browser on this device.
    </footer>
  );
}

/** Palette tile shape follows widely documented CAT conventions. */
export function StatusTile({ status, label, onClick, current, small }: { status: QStatus; label: ReactNode; onClick?: () => void; current?: boolean; small?: boolean }) {
  const cls = `tile tile-${status}${current ? ' tile-current' : ''}${small ? ' tile-small' : ''}`;
  if (onClick) return <button type="button" className={cls} onClick={onClick} aria-label={`Question ${label}: ${STATUS_LABEL[status]}`} aria-current={current ? 'true' : undefined}>{label}</button>;
  return <span className={cls} aria-hidden="true">{label}</span>;
}

export function Legend({ counts }: { counts?: Record<QStatus, number> }) {
  const order: QStatus[] = ['answered', 'notAnswered', 'notVisited', 'marked', 'answeredMarked'];
  return (
    <ul className="legend">
      {order.map((s) => (
        <li key={s}><StatusTile status={s} label={counts ? counts[s] : ''} small /> <span>{STATUS_LABEL[s]}</span></li>
      ))}
    </ul>
  );
}

export function Html({ html, className, as = 'div' }: { html: string; className?: string; as?: 'div' | 'span' | 'p' }) {
  const Tag = as;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function pct(x: number) { return `${Math.round(x * 1000) / 10}%`; }
export function fmtDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export const KIND_LABEL: Record<string, string> = {
  rc: 'Reading Comprehension', summary: 'Para Summary', placement: 'Sentence Placement', parajumble: 'Para Jumble', oddoneout: 'Odd Sentence Out',
};
