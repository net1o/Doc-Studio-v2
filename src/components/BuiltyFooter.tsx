import { ArrowUp, ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { AppTab, UniversalSettings } from '../types/journal';
import { BrandexLogo } from './BrandexLogo';

interface BuiltyFooterProps {
  onSelectTab: (tab: AppTab) => void;
  onScrollTop: () => void;
  themeSettings?: UniversalSettings;
}

export function BuiltyFooter({ onSelectTab, onScrollTop, themeSettings }: BuiltyFooterProps) {
  const logoPrimary = themeSettings?.docPrimaryColor || '#290076';
  const logoAccent = themeSettings?.docAccentColor || '#f4580b';
  const uiAccent = themeSettings?.uiAccentColor || '#ffee00';

  return (
    <footer className="no-print mt-12">
      {/* Consultation Strip with Logo-Final */}
      <div className="bg-white border-t border-b border-[#e2e4ea]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandexLogo
              variant="logoFinal"
              size="sm"
              primaryColor={logoPrimary}
              accentColor={logoAccent}
            />
            <div>
              <p className="text-sm font-extrabold text-[#111111]">Brandex Law Associate</p>
              <p className="text-xs text-[#555a66]">Journal Monitor &amp; Document System</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab('generator')}
            className="builty-btn h-[40px] pl-5 pr-2.5 gap-3 text-xs whitespace-nowrap"
          >
            <span>Open Document Generator</span>
            <span className="builty-btn-icon-tab w-7 h-6">
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      {/* Main Corporate Footer with Logo-Final on Dark */}
      <div className="bg-[#111111] text-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-9 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <BrandexLogo
              variant="logoFinal"
              size="md"
              primaryColor={logoPrimary}
              accentColor={logoAccent || uiAccent}
              onDark
            />
            <p className="text-xs text-[#9c9ca6] leading-relaxed max-w-sm">
              Brandex Law Associate · Journal Monitor &amp; Case Records Workspace.
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-base font-bold text-white">Office</h3>
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
            <h3 className="text-base font-bold text-white">Workspace</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#c7c7d1]">
              <button type="button" onClick={() => onSelectTab('analyzer')} className="text-left hover:text-[#ffee00]">
                Dashboard
              </button>
              <button type="button" onClick={() => onSelectTab('journalcheck')} className="text-left hover:text-[#ffee00]">
                JournalCheck
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
                Settings
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1d1d22]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 text-xs text-[#8e8e98]">
            <span className="inline-flex items-center gap-2">
              <BrandexLogo
                variant="logo17Icon"
                size="xs"
                discColor={themeSettings?.uiDarkColor || '#111111'}
                accentColor={uiAccent || '#f5c400'}
                onDark
              />
              <span>Brandex Law Associate</span>
            </span>
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
