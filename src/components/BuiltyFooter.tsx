import { ArrowUp, ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { AppTab } from '../types/journal';

interface BuiltyFooterProps {
  onSelectTab: (tab: AppTab) => void;
  onScrollTop: () => void;
}

export function BuiltyFooter({ onSelectTab, onScrollTop }: BuiltyFooterProps) {
  return (
    <footer className="no-print mt-12">
      {/* Builty Consultation Strip */}
      <div className="bg-white border-t border-b border-[#e2e4ea]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg width="30" height="30" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <polygon points="4,30 18,4 32,30" fill="#ffee00" stroke="#111111" strokeWidth="1.5" />
              <polygon points="11,30 18,16 25,30" fill="#111111" />
            </svg>
            <div>
              <p className="text-sm font-extrabold text-[#111111]">Brandex Law Associate</p>
              <p className="text-xs text-[#555a66]">
                Database &amp; Journal Monitor System · Trademark watchlist &amp; Legal 8.5×14 automation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab('generator')}
            className="builty-btn h-[42px] pl-5 pr-2.5 gap-3 text-xs whitespace-nowrap"
          >
            <span>Open 909 Doc Generator</span>
            <span className="builty-btn-icon-tab w-7 h-7">
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      {/* Main Corporate Footer */}
      <div className="bg-[#111111] text-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2.5">
            <h3 className="text-base font-bold text-white">Information</h3>
            <p className="text-xs text-[#9c9ca6] leading-relaxed max-w-sm">
              Brandex Law Associate — Database &amp; Journal Monitor System uniting monthly Trademark Journal scanning, 24-column Google Sheet case synchronization, and Legal 8.5×14 print generation.
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-base font-bold text-white">Office &amp; Dispatch</h3>
            <ul className="space-y-2 text-xs text-[#c7c7d1]">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#ffee00] shrink-0 mt-0.5" aria-hidden="true" />
                <span>Abdullah Centre, Jinnah Colony behind PTCL Exchange, Tarlai, Islamabad</span>
              </li>
              <li className="flex items-center gap-2.5 tabular-nums">
                <Phone className="w-4 h-4 text-[#ffee00] shrink-0" aria-hidden="true" />
                <span>+92 336 0015004</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#ffee00] shrink-0" aria-hidden="true" />
                <span>info@brandex.pk</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-base font-bold text-white">Quick Workspace</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#c7c7d1]">
              <button type="button" onClick={() => onSelectTab('analyzer')} className="text-left hover:text-[#ffee00]">
                Dashboard &amp; Watchlist
              </button>
              <button type="button" onClick={() => onSelectTab('journalcheck')} className="text-left hover:text-[#ffee00]">
                JournalCheck Input
              </button>
              <button type="button" onClick={() => onSelectTab('review')} className="text-left hover:text-[#ffee00]">
                Review Queue
              </button>
              <button type="button" onClick={() => onSelectTab('database')} className="text-left hover:text-[#ffee00]">
                Cases Database
              </button>
              <button type="button" onClick={() => onSelectTab('records')} className="text-left hover:text-[#ffee00]">
                Records &amp; Report
              </button>
              <button type="button" onClick={() => onSelectTab('settings')} className="text-left hover:text-[#ffee00]">
                Settings (CFG)
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1d1d22]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 text-xs text-[#8e8e98]">
            <span>Brandex Law Associate · Database &amp; Journal Monitor System · Legal 8.5×14 Edition</span>
            <button
              type="button"
              onClick={onScrollTop}
              aria-label="Scroll back to top"
              className="w-10 h-10 rounded-full bg-[#ffee00] text-black flex items-center justify-center ring-2 ring-dashed ring-[#ffee00]/50 ring-offset-2 ring-offset-black hover:bg-[#e6d600]"
            >
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
