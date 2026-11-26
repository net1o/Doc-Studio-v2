import { useState } from 'react';
import { Menu, Play, Volume2, VolumeX, X } from 'lucide-react';
import { AppTab, UniversalSettings } from '../types/journal';
import { BrandexLogo } from './BrandexLogo';

interface BuiltyHeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onRunScan: () => void;
  activeContextCount: number;
  watchlistCount: number;
  journalRowsCount: number;
  reviewCount: number;
  docsCount: number;
  databaseCount: number;
  recordsCount: number;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  themeSettings?: UniversalSettings;
}

export function BuiltyHeader({
  activeTab,
  onSelectTab,
  onRunScan,
  activeContextCount,
  watchlistCount,
  journalRowsCount,
  reviewCount,
  docsCount,
  databaseCount,
  recordsCount,
  sfxEnabled,
  onToggleSfx,
  themeSettings,
}: BuiltyHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logoPrimary = themeSettings?.docPrimaryColor || '#290076';
  const logoAccent = themeSettings?.docAccentColor || '#f4580b';

  const navItems: { id: AppTab; label: string; shortcut: string; count: number | null }[] = [
    { id: 'analyzer', label: 'Dashboard', shortcut: 'Ctrl+1', count: watchlistCount },
    { id: 'journalcheck', label: 'JournalCheck', shortcut: 'Ctrl+2', count: journalRowsCount },
    { id: 'review', label: 'Review', shortcut: 'Ctrl+3', count: reviewCount },
    { id: 'generator', label: 'Doc Gen', shortcut: 'Ctrl+4', count: docsCount },
    { id: 'database', label: 'Database', shortcut: 'Ctrl+5', count: databaseCount },
    { id: 'records', label: 'Records', shortcut: 'Ctrl+6', count: recordsCount },
    { id: 'settings', label: 'Settings', shortcut: 'Ctrl+7', count: null },
    { id: 'backup', label: 'Backup', shortcut: 'Ctrl+8', count: activeContextCount },
  ];

  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e2e4ea]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-3 xl:gap-5">
        {/* Zone 1: Brandex Logo-Final Primary Branding */}
        <button
          type="button"
          onClick={() => onSelectTab('analyzer')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#111111]"
        >
          <BrandexLogo
            variant="logoFinal"
            size="md"
            primaryColor={logoPrimary}
            accentColor={logoAccent}
          />
          <span className="hidden sm:inline-block border-l border-[#e2e4ea] pl-2.5 text-[12px] font-extrabold tracking-tight text-[#111111]">
            Law Associate
          </span>
        </button>

        {/* Zone 2: Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center lg:gap-1.5 xl:gap-2.5 text-[11.5px] xl:text-[12.5px] font-bold"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const displayCount = active ? activeContextCount : item.count;
            return (
              <button
                key={item.id}
                type="button"
                data-sfx="filter"
                data-active={active}
                title={`${item.label} (${item.shortcut})`}
                onClick={() => onSelectTab(item.id)}
                className={`builty-nav-tab relative py-2 px-2 xl:px-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#111111] ${
                  active
                    ? 'text-[#111111] bg-[#fffef0]'
                    : 'text-[#555a66] hover:text-[#111111]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <span>{item.label}</span>
                  {displayCount !== null && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-extrabold leading-none transition-colors ${
                        active
                          ? 'bg-[#111111] text-[#ffee00]'
                          : item.id === 'backup'
                          ? 'bg-[#ffee00] text-[#111111] border border-[#111111]/20'
                          : 'bg-[#f1f2f5] text-[#111111]'
                      }`}
                    >
                      {displayCount}
                    </span>
                  )}
                </span>
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

        {/* Zone 3: Sound Toggle + Primary Slanted CTA + Mobile Trigger */}
        <div className="flex items-center gap-2 shrink-0">
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
            className="builty-btn h-[40px] pl-3.5 pr-2 gap-2.5 text-[12.5px] tracking-wide whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#111111]"
          >
            <span>Run Scan</span>
            <span className="builty-btn-icon-tab w-7 h-6">
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
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const displayCount = active ? activeContextCount : item.count;
            return (
              <button
                key={item.id}
                type="button"
                data-sfx="filter"
                data-active={active}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold border-b border-[#eceef2] last:border-b-0 ${
                  active
                    ? 'bg-[#fffef0] text-[#111111] border-l-4 border-l-[#ffee00]'
                    : 'text-[#555a66] hover:text-[#111111]'
                }`}
              >
                <span>{item.label}</span>
                <span className="inline-flex items-center gap-2 text-xs tabular-nums">
                  {displayCount !== null && (
                    <span className="px-1.5 py-0.5 bg-[#111111] text-[#ffee00] font-extrabold text-[11px]">
                      {displayCount}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-[#6b7280]">{item.shortcut}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
