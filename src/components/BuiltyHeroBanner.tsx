import { ArrowRight, Home } from 'lucide-react';
import { AppTab } from '../types/journal';

interface BuiltyHeroBannerProps {
  journalNo: string;
  journalDate: string;
  activeTab: AppTab;
  onOpenGenerator: () => void;
}

const TAB_LABELS: Record<AppTab, string> = {
  analyzer: 'Analyzer & Watchlist',
  journalcheck: 'JournalCheck Input',
  review: 'Review Queue',
  generator: 'Journal 909 Legal (8.5×14) Generator',
  records: 'Records & Analytics Report',
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
      className="no-print relative overflow-hidden bg-[#050506] border-b border-[#232328]"
    >
      {/* Subtle geometric line curves inspired by Builty header backdrop */}
      <svg
        aria-hidden="true"
        className="absolute right-0 top-0 h-full w-[520px] opacity-20 pointer-events-none"
        viewBox="0 0 520 220"
        fill="none"
      >
        <path d="M520 0C380 40 320 120 280 220" stroke="#45454e" strokeWidth="18" />
        <path d="M520 40C410 75 360 140 330 220" stroke="#35353d" strokeWidth="14" />
        <path d="M520 85C440 110 400 160 380 220" stroke="#28282f" strokeWidth="12" />
        <path d="M520 130C470 150 445 180 432 220" stroke="#1f1f25" strokeWidth="10" />
      </svg>

      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Journal Monitor &amp; Doc Generator
            </h1>
            <p className="text-sm text-[#b5b5be] leading-relaxed">
              Trademark journal analyzer, watchlist scanner, and Legal 8.5×14 publication document generator for Journal {journalNo || '909'}.
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

        <div className="mt-5 pt-4 border-t border-[#1e1e23] flex flex-wrap items-center gap-2 text-xs text-[#a6a6b0] tabular-nums">
          <Home className="w-3.5 h-3.5 text-[#ffee00]" aria-hidden="true" />
          <span className="text-white font-medium">Journal {journalNo || '909'}</span>
          <span aria-hidden="true">/</span>
          <span>{journalDate || '26-Nov-2026'}</span>
          <span aria-hidden="true">/</span>
          <span className="text-[#ffee00] font-semibold">{TAB_LABELS[activeTab]}</span>
        </div>
      </div>
    </section>
  );
}
