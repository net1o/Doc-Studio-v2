import { ArrowRight, Home } from 'lucide-react';
import { AppTab, UniversalSettings } from '../types/journal';
import { BrandexLogo } from './BrandexLogo';
import { BrandexButtonIcon } from './BrandexButtonIcon';

interface BuiltyHeroBannerProps {
  journalNo: string;
  journalDate: string;
  activeTab: AppTab;
  onOpenGenerator: () => void;
  themeSettings?: UniversalSettings;
}

const TAB_LABELS: Record<AppTab, string> = {
  analyzer: 'Dashboard',
  journalcheck: 'JournalCheck',
  review: 'Review Queue',
  generator: 'Document Generator',
  database: 'Cases Database',
  records: 'Records & Report',
  settings: 'Settings',
  backup: 'Backup',
};

export function BuiltyHeroBanner({
  journalNo,
  journalDate,
  activeTab,
  onOpenGenerator,
  themeSettings,
}: BuiltyHeroBannerProps) {
  return (
    <section
      aria-label="Workspace overview"
      className="no-print relative overflow-hidden bg-white border-b border-[#e2e4ea]"
    >
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

      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <BrandexLogo
              variant="logo17Icon"
              size="lg"
              discColor={themeSettings?.uiDarkColor || '#111111'}
              accentColor={themeSettings?.uiAccentColor || '#f5c400'}
              className="shrink-0"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111] [text-wrap:balance]">
                Brandex Law Associate
              </h1>
              <p className="text-xs font-bold text-[#555a66] mt-0.5 tabular-nums">
                Journal {journalNo || '909'} · {journalDate || '26-Nov-2026'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenGenerator}
            className="builty-btn self-start md:self-auto h-[40px] pl-3 pr-2.5 gap-2 text-xs tracking-wide whitespace-nowrap shrink-0"
          >
            <BrandexButtonIcon
              name="generator"
              size={22}
              colorMode={themeSettings?.imageColorMode}
            />
            <span>Open Document</span>
            <span className="builty-btn-icon-tab w-7 h-6">
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-[#eceef2] flex flex-wrap items-center gap-2 text-xs text-[#555a66] tabular-nums">
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
