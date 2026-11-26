import { useState } from 'react';
import { Menu, Play, X } from 'lucide-react';
import { AppTab } from '../types/journal';

interface BuiltyHeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onRunScan: () => void;
  reviewCount: number;
  docsCount: number;
}

export function BuiltyHeader({
  activeTab,
  onSelectTab,
  onRunScan,
  reviewCount,
  docsCount,
}: BuiltyHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: AppTab; label: string }[] = [
    { id: 'analyzer', label: 'Analyzer' },
    { id: 'journalcheck', label: 'JournalCheck' },
    { id: 'review', label: `Review (${reviewCount})` },
    { id: 'generator', label: `Doc Generator (${docsCount})` },
    { id: 'records', label: 'Records' },
    { id: 'backup', label: 'Backup' },
  ];

  return (
    <header className="no-print sticky top-0 z-40 bg-[#000000]/95 backdrop-blur-sm border-b border-[#232328]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-6">
        {/* Zone 1: Brand Mark */}
        <button
          type="button"
          onClick={() => onSelectTab('analyzer')}
          className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#ffee00]"
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <polygon points="4,30 18,4 32,30" fill="#ffee00" />
            <polygon points="11,30 18,16 25,30" fill="#000000" />
            <rect x="16" y="22" width="4" height="8" fill="#ffee00" />
          </svg>
          <span className="text-[19px] font-extrabold tracking-tight text-white">
            Journal Monitor
          </span>
        </button>

        {/* Zone 2: Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-6 text-[13.5px] font-semibold"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#ffee00] ${
                  active ? 'text-[#ffee00]' : 'text-[#e2e2e8] hover:text-[#ffee00]'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#ffee00]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Slanted Builty CTA + Mobile Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRunScan}
            className="builty-btn h-[42px] pl-4 pr-2 gap-3 text-[13px] tracking-wide whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
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
            className="lg:hidden p-2 border border-[#2f2f36] text-white hover:border-[#ffee00] hover:text-[#ffee00]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#232328] bg-[#0a0a0c] px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 text-sm font-semibold border-b border-[#1d1d22] last:border-b-0 ${
                activeTab === item.id ? 'text-[#ffee00]' : 'text-white'
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
