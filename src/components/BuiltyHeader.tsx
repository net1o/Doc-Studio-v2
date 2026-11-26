import { useState } from 'react';
import { Menu, Play, Volume2, VolumeX, X } from 'lucide-react';
import { AppTab } from '../types/journal';

interface BuiltyHeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onRunScan: () => void;
  reviewCount: number;
  docsCount: number;
  databaseCount: number;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
}

export function BuiltyHeader({
  activeTab,
  onSelectTab,
  onRunScan,
  reviewCount,
  docsCount,
  databaseCount,
  sfxEnabled,
  onToggleSfx,
}: BuiltyHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: AppTab; label: string }[] = [
    { id: 'analyzer', label: 'Analyzer' },
    { id: 'journalcheck', label: 'JournalCheck' },
    { id: 'review', label: `Review (${reviewCount})` },
    { id: 'generator', label: `Doc Generator (${docsCount})` },
    { id: 'database', label: `Database (${databaseCount})` },
    { id: 'records', label: 'Records' },
    { id: 'settings', label: 'Settings' },
    { id: 'backup', label: 'Backup' },
  ];

  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e2e4ea]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4 xl:gap-6">
        {/* Zone 1: Brand Mark */}
        <button
          type="button"
          onClick={() => onSelectTab('analyzer')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#111111]"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <polygon points="4,30 18,4 32,30" fill="#ffee00" stroke="#111111" strokeWidth="1.5" />
            <polygon points="11,30 18,16 25,30" fill="#111111" />
            <rect x="16" y="22" width="4" height="8" fill="#ffee00" />
          </svg>
          <span className="text-[18px] font-extrabold tracking-tight text-[#111111]">
            Journal Monitor
          </span>
        </button>

        {/* Zone 2: Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center lg:gap-3.5 xl:gap-5 text-[12.5px] xl:text-[13px] font-bold"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-sfx="filter"
                data-active={active}
                onClick={() => onSelectTab(item.id)}
                className={`builty-filter-btn relative py-2 px-1 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#111111] ${
                  active ? 'text-[#111111]' : 'text-[#555a66] hover:text-[#111111]'
                }`}
              >
                <span className="tabular-nums">{item.label}</span>
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 bottom-0 h-[3px] bg-[#ffee00] transition-transform duration-200 origin-left ${
                    active ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Sound Toggle + Primary Slanted Builty CTA + Mobile Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleSfx}
            aria-label={sfxEnabled ? 'Mute button click sounds' : 'Enable button click sounds'}
            title={sfxEnabled ? 'Button SFX: On' : 'Button SFX: Muted'}
            className={`h-[38px] w-[38px] border inline-flex items-center justify-center transition-colors ${
              sfxEnabled
                ? 'border-[#cbd0da] bg-[#f8f9fb] text-[#111111] hover:border-[#111111] hover:bg-[#fffef0]'
                : 'border-[#e2e4ea] bg-white text-[#9ca3af] hover:text-[#111111]'
            }`}
          >
            {sfxEnabled ? (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onRunScan}
            className="builty-btn h-[42px] pl-4 pr-2 gap-3 text-[13px] tracking-wide whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#111111]"
          >
            <span>Run Scan</span>
            <span className="builty-btn-icon-tab w-8 h-7">
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 border border-[#cbd0da] bg-white text-[#111111] hover:border-[#111111]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#e2e4ea] bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              data-sfx="filter"
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 text-sm font-bold border-b border-[#eceef2] last:border-b-0 ${
                activeTab === item.id
                  ? 'bg-[#fffef0] text-[#111111]'
                  : 'text-[#555a66] hover:text-[#111111]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
