import { ArrowRight, Home } from 'lucide-react';
import { AppTab } from '../types/journal';

interface BuiltyHeroBannerProps {
  journalNo: string;
  journalDate: string;
  activeTab: AppTab;
  onOpenGenerator: () => void;
}

const TAB_LABELS: Record<AppTab, string> = {
  analyzer: 'Dashboard & Watchlist',
  journalcheck: 'JournalCheck Input',
  review: 'Review Queue',
  generator: 'Journal 909 Document Generator',
  database: 'Cases Database (24 Columns)',
  records: 'Records & Analytics Report',
  settings: 'Scanner & Database Settings (CFG)',
  backup: 'Backup & Diagnostics',
};

export function BuiltyHeroBanner({
  journalNo,
  journalDate,
  activeTab,
  onOpenGenerator,
}: BuiltyHeroBannerProps) {
  return (
    <section
      aria-label="Workspace overview"
      className="no-print relative overflow-hidden bg-white border-b border-[#e2e4ea]"
    >
      {/* Subtle geometric line curves inspired by Builty header backdrop */}
      <svg
        aria-hidden="true"
        className="absolute right-0 top-0 h-full w-[520px] pointer-events-none"
        viewBox="0 0 520 220"
        fill="none"
      >
        <path d="M520 0C380 40 320 120 280 220" stroke="#eceef3" strokeWidth="18" />
        <path d="M520 40C410 75 360 140 330 220" stroke="#f1f3f7" strokeWidth="14" />
        <path d="M520 85C440 110 400 160 380 220" stroke="#f5f6f9" strokeWidth="12" />
        <path d="M520 130C470 150 445 180 432 220" stroke="#f9f9fb" strokeWidth="10" />
      </svg>

      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#111111] [text-wrap:balance]">
              Brandex Law Associate
            </h1>
            <p className="text-sm text-[#555a66] leading-relaxed">
              <span className="font-bold text-[#111111]">Database &amp; Journal Monitor System</span> — Trademark watchlist scanner, 24-column case database, and Legal 8.5×14 publication generator for Journal {journalNo || '909'}.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenGenerator}
            className="builty-btn self-start md:self-auto h-[42px] pl-4 pr-2.5 gap-2.5 text-xs tracking-wide whitespace-nowrap shrink-0"
          >
            <span>Open 909 Template</span>
            <span className="builty-btn-icon-tab w-7 h-7">
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-[#eceef2] flex flex-wrap items-center gap-2 text-xs text-[#555a66] tabular-nums">
          <span className="inline-flex items-center justify-center w-5 h-5 bg-[#ffee00] text-[#111111]">
            <Home className="w-3 h-3" aria-hidden="true" />
          </span>
          <span className="text-[#111111] font-bold">Journal {journalNo || '909'}</span>
          <span aria-hidden="true">/</span>
          <span>{journalDate || '26-Nov-2026'}</span>
          <span aria-hidden="true">/</span>
          <span className="text-[#111111] font-bold">{TAB_LABELS[activeTab]}</span>
        </div>
      </div>
    </section>
  );
}
