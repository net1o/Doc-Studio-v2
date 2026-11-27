import { useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Database,
  Download,
  ExternalLink,
  LogOut,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  CaseSheetConfig,
  DocumentThemePreset,
  ImageColorMode,
  JournalConfig,
  KeywordMatchMode,
  UniversalSettings,
} from '../types/journal';
import {
  DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
  DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
  USER_WATCHLIST_KEYWORDS,
  USER_WATCHLIST_TM_NUMBERS,
} from '../lib/journal/watchlistSeed';
import { DEFAULT_UNIVERSAL_SETTINGS, JournalMonitorState } from '../lib/journal/store';
import { formatCompositeCaseNo } from '../lib/journal/engine';
import { BRANDING_ASSETS, BrandingCategory } from '../lib/branding/brandingAssets';
import { BrandexLogo } from './BrandexLogo';
import { BrandexButtonIcon } from './BrandexButtonIcon';
import { useFirebase } from './FirebaseProvider';

interface SettingsViewProps {
  config: JournalConfig;
  fullState: JournalMonitorState;
  onUpdateConfig: (next: JournalConfig) => void;
  onResetSampleData: () => void;
  onNotify: (message: string) => void;
  onOpenDatabase: () => void;
}

const THEME_PRESETS: Record<
  Exclude<DocumentThemePreset, 'custom'>,
  {
    label: string;
    docPrimaryColor: string;
    docSecondaryColor: string;
    docAccentColor: string;
    uiAccentColor: string;
    uiDarkColor: string;
  }
> = {
  brandex_violet: {
    label: 'Brandex Violet & Orange',
    docPrimaryColor: '#290076',
    docSecondaryColor: '#4e1cb8',
    docAccentColor: '#f4580b',
    uiAccentColor: '#ffee00',
    uiDarkColor: '#111111',
  },
  builty_yellow: {
    label: 'Industrial Yellow & Onyx',
    docPrimaryColor: '#111111',
    docSecondaryColor: '#374151',
    docAccentColor: '#d97706',
    uiAccentColor: '#ffee00',
    uiDarkColor: '#111111',
  },
  navy_gold: {
    label: 'Chambers Navy & Gold',
    docPrimaryColor: '#0f2557',
    docSecondaryColor: '#1e3a8a',
    docAccentColor: '#d97706',
    uiAccentColor: '#facc15',
    uiDarkColor: '#0f172a',
  },
  emerald_amber: {
    label: 'Emerald & Amber',
    docPrimaryColor: '#064e3b',
    docSecondaryColor: '#047857',
    docAccentColor: '#d97706',
    uiAccentColor: '#fde047',
    uiDarkColor: '#064e3b',
  },
  crimson_slate: {
    label: 'Crimson & Slate',
    docPrimaryColor: '#7f1d1d',
    docSecondaryColor: '#b91c1c',
    docAccentColor: '#b45309',
    uiAccentColor: '#fef08a',
    uiDarkColor: '#18181b',
  },
};

export function SettingsView({
  config,
  fullState,
  onUpdateConfig,
  onResetSampleData,
  onNotify,
  onOpenDatabase,
}: SettingsViewProps) {
  const journalNoInputRef = useRef<HTMLInputElement>(null);
  const [assetCategory, setAssetCategory] = useState<'all' | BrandingCategory>('all');
  const {
    hasConfig,
    projectId,
    databaseId,
    user,
    cloudStatus,
    cloudError,
    quotaUpgradeUrl,
    lastSyncedAt,
    signIn,
    signOutUser,
    pushLocalWorkspaceToCloud,
  } = useFirebase();

  const universal: UniversalSettings = {
    ...DEFAULT_UNIVERSAL_SETTINGS,
    ...(config.universalSettings || {}),
  };

  const sheetCfg: CaseSheetConfig = config.caseSheetConfig || {
    sheetUrlOrId: DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
    sheetName: DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
    keyCol: 8,
    prefixCol: 3,
    clientCodeCol: 4,
    caseCol: 5,
    clientCol: 6,
    appNameCol: 7,
    caseSeparator: '-',
  };

  const updateUniversal = (patch: Partial<UniversalSettings>) => {
    onUpdateConfig({
      ...config,
      universalSettings: {
        ...universal,
        ...patch,
      },
    });
  };

  const handleSelectThemePreset = (presetKey: DocumentThemePreset) => {
    if (presetKey === 'custom') {
      updateUniversal({ themePreset: 'custom' });
      return;
    }
    const preset = THEME_PRESETS[presetKey];
    updateUniversal({
      themePreset: presetKey,
      docPrimaryColor: preset.docPrimaryColor,
      docSecondaryColor: preset.docSecondaryColor,
      docAccentColor: preset.docAccentColor,
      uiAccentColor: preset.uiAccentColor,
      uiDarkColor: preset.uiDarkColor,
    });
    onNotify(`Theme applied: ${preset.label}.`);
  };

  const updateSheetConfig = (patch: Partial<CaseSheetConfig>) => {
    onUpdateConfig({
      ...config,
      caseSheetConfig: {
        ...sheetCfg,
        ...patch,
      },
    });
  };

  const handleRestoreSeedWatchlist = () => {
    const mergedKeywords = Array.from(
      new Set([...config.keywords, ...USER_WATCHLIST_KEYWORDS])
    );
    const mergedTms = Array.from(
      new Set([...config.tmNumbers, ...USER_WATCHLIST_TM_NUMBERS])
    );
    onUpdateConfig({
      ...config,
      keywords: mergedKeywords,
      tmNumbers: mergedTms,
    });
    onNotify(
      `Watchlist updated: ${mergedKeywords.length} keywords and ${mergedTms.length} TMs.`
    );
  };

  const sepPreview = formatCompositeCaseNo('A', '32', '4', sheetCfg.caseSeparator || '-');

  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | BrandingCategory, number> = {
      all: BRANDING_ASSETS.length,
      logos: 0,
      favicons: 0,
      icons: 0,
      buttons: 0,
      cards: 0,
    };
    for (const asset of BRANDING_ASSETS) {
      counts[asset.category] += 1;
    }
    return counts;
  }, []);

  const visibleBrandingAssets = useMemo(
    () =>
      assetCategory === 'all'
        ? BRANDING_ASSETS
        : BRANDING_ASSETS.filter((item) => item.category === assetCategory),
    [assetCategory]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#e2e4ea] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandexButtonIcon
            name="settings"
            size={34}
            colorMode={universal.imageColorMode}
          />
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
            Workspace &amp; Universal Settings
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenDatabase}
          className="h-[38px] px-4 border border-[#111111] bg-white hover:bg-[#f6f7f9] text-xs font-bold text-[#111111] inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Database className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Open Database</span>
        </button>
      </div>

      {/* FIREBASE CLOUD SYNC & AUTHENTICATION CARD */}
      <section className="bg-white border border-[#111111] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#eceef2] pb-4">
          <div className="flex items-start gap-3">
            <span
              className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                user ? 'bg-emerald-100 text-emerald-900' : 'bg-[#ffee00] text-[#111111]'
              }`}
            >
              {cloudStatus === 'syncing' || cloudStatus === 'connecting' ? (
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : user ? (
                <Cloud className="w-4 h-4" aria-hidden="true" />
              ) : (
                <CloudOff className="w-4 h-4" aria-hidden="true" />
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-[#111111]">
                  Firebase Firestore Cloud Sync
                </h3>
                <span
                  className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border ${
                    cloudStatus === 'synced'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                      : cloudStatus === 'error' || cloudStatus === 'quota_exceeded'
                      ? 'bg-red-50 border-red-400 text-red-900'
                      : cloudStatus === 'syncing' || cloudStatus === 'connecting'
                      ? 'bg-amber-50 border-amber-400 text-amber-900'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  {cloudStatus === 'local'
                    ? 'Local Browser Mode'
                    : cloudStatus === 'connecting'
                    ? 'Connecting'
                    : cloudStatus === 'syncing'
                    ? 'Syncing'
                    : cloudStatus === 'synced'
                    ? 'Synced Live'
                    : cloudStatus === 'quota_exceeded'
                    ? 'Quota Limit Reached'
                    : 'Sync Error'}
                </span>
              </div>
              <p className="text-xs text-[#555a66] mt-1 font-mono">
                Project: {projectId || 'Not configured'} · DB: {databaseId}
                {lastSyncedAt ? ` · Last Sync: ${lastSyncedAt}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasConfig ? (
              user ? (
                <>
                  <span className="px-3 py-2 bg-[#f8f9fb] border border-[#cbd0da] text-xs font-bold text-[#111111]">
                    {user.email || user.displayName || user.uid}
                  </span>
                  <button
                    type="button"
                    onClick={() => void pushLocalWorkspaceToCloud(fullState)}
                    disabled={cloudStatus === 'syncing'}
                    className="h-[36px] px-3 bg-[#111111] text-[#ffee00] hover:bg-[#2a2f3a] disabled:opacity-50 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sync Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="h-[36px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void signIn()}
                  className="h-[38px] px-4 bg-[#111111] text-[#ffee00] hover:bg-[#2a2f3a] text-xs font-bold inline-flex items-center gap-2"
                >
                  <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign in with Google to Enable Cloud Sync</span>
                </button>
              )
            ) : (
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1.5">
                Firebase config missing
              </span>
            )}
          </div>
        </div>

        {cloudError && (
          <div className="bg-red-50 border border-red-300 px-3.5 py-2.5 text-xs text-red-900 flex flex-wrap items-center justify-between gap-2">
            <span>{cloudError}</span>
            {quotaUpgradeUrl && (
              <a
                href={quotaUpgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline inline-flex items-center gap-1 text-red-950"
              >
                <span>Open Firestore Upgrade Console</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </section>

      {/* UNIVERSAL SETTINGS CARD */}
      <section className="bg-white border border-[#111111] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eceef2] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 bg-[#ffee00] text-[#111111] flex items-center justify-center">
              <Palette className="w-4 h-4" aria-hidden="true" />
            </span>
            <h3 className="text-base font-extrabold text-[#111111]">Universal Settings</h3>
          </div>

          {/* Live Brandex Theme Swatch Preview */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-[#f8f9fb] border border-[#e2e4ea]">
              <BrandexLogo
                variant="logoFinal"
                size="sm"
                primaryColor={universal.docPrimaryColor}
                accentColor={universal.docAccentColor}
              />
              <BrandexLogo
                variant="logo17"
                size="sm"
                primaryColor={universal.docPrimaryColor}
                discColor={universal.uiDarkColor || '#111111'}
                accentColor={universal.uiAccentColor || '#f5c400'}
              />
            </div>
            <div className="px-3 py-1.5 bg-[#111111] border border-[#111111]">
              <BrandexLogo
                variant="logoFinal"
                size="sm"
                primaryColor={universal.docPrimaryColor}
                accentColor={universal.docAccentColor}
                onDark
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Table Page Size */}
          <div>
            <label htmlFor="univ-page-size" className="block text-xs font-bold text-[#374151] mb-1.5">
              Records Per Table Page
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="univ-page-size"
                type="number"
                min={10}
                max={500}
                value={universal.tablePageSize}
                onChange={(e) =>
                  updateUniversal({
                    tablePageSize: Math.max(10, Math.min(500, Number(e.target.value) || 50)),
                  })
                }
                className="w-20 bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono font-bold text-[#111111]"
              />
              {[25, 50, 100].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  data-sfx="filter"
                  onClick={() => updateUniversal({ tablePageSize: sz })}
                  className={`px-2 py-2 border text-[11px] font-bold ${
                    universal.tablePageSize === sz
                      ? 'bg-[#ffee00] border-[#111111] text-[#111111]'
                      : 'bg-white border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Default Inline Edit Mode */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1.5">
              Table Edit Mode Default
            </label>
            <button
              type="button"
              data-sfx="filter"
              onClick={() => updateUniversal({ enableInlineEdit: !universal.enableInlineEdit })}
              className={`w-full h-[36px] px-3 border text-xs font-bold text-left flex items-center justify-between ${
                universal.enableInlineEdit
                  ? 'bg-[#111111] border-[#111111] text-[#ffee00]'
                  : 'bg-[#f8f9fb] border-[#cbd0da] text-[#111111]'
              }`}
            >
              <span>{universal.enableInlineEdit ? 'Input Mode: ON' : 'Click-to-Edit Mode'}</span>
              <span className="font-mono text-[10px]">
                {universal.enableInlineEdit ? 'ACTIVE' : 'STANDARD'}
              </span>
            </button>
          </div>

          {/* Theme Preset */}
          <div>
            <label htmlFor="univ-theme-preset" className="block text-xs font-bold text-[#374151] mb-1.5">
              Theme Palette
            </label>
            <select
              id="univ-theme-preset"
              value={universal.themePreset}
              onChange={(e) => handleSelectThemePreset(e.target.value as DocumentThemePreset)}
              className="w-full h-[36px] bg-[#f8f9fb] border border-[#cbd0da] px-3 text-xs font-bold text-[#111111]"
            >
              {Object.entries(THEME_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
              <option value="custom">Custom Colors</option>
            </select>
          </div>

          {/* Image / Artwork Color Mode */}
          <div>
            <label htmlFor="univ-img-mode" className="block text-xs font-bold text-[#374151] mb-1.5">
              Image &amp; Logo Color Mode
            </label>
            <select
              id="univ-img-mode"
              value={universal.imageColorMode}
              onChange={(e) =>
                updateUniversal({ imageColorMode: e.target.value as ImageColorMode })
              }
              className="w-full h-[36px] bg-[#f8f9fb] border border-[#cbd0da] px-3 text-xs font-bold text-[#111111]"
            >
              <option value="theme">Adapt to Theme Color</option>
              <option value="original">Original Artwork Colors</option>
              <option value="grayscale">Monochrome / Print Grayscale</option>
            </select>
          </div>
        </div>

        {/* Custom Color Pickers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#eceef2]">
          {[
            { label: 'Primary Color', key: 'docPrimaryColor' as const, val: universal.docPrimaryColor },
            { label: 'Secondary Color', key: 'docSecondaryColor' as const, val: universal.docSecondaryColor },
            { label: 'Heading Accent', key: 'docAccentColor' as const, val: universal.docAccentColor },
            { label: 'UI Highlight', key: 'uiAccentColor' as const, val: universal.uiAccentColor },
          ].map((c) => (
            <label
              key={c.key}
              className="flex items-center justify-between gap-2 bg-[#f8f9fb] border border-[#e2e4ea] px-3 py-2 cursor-pointer"
            >
              <div>
                <div className="text-[11px] font-bold text-[#111111]">{c.label}</div>
                <div className="text-[10px] font-mono text-[#555a66] uppercase">{c.val}</div>
              </div>
              <input
                type="color"
                value={c.val}
                onChange={(e) =>
                  updateUniversal({
                    themePreset: 'custom',
                    [c.key]: e.target.value,
                  })
                }
                className="w-8 h-8 border border-[#cbd0da] bg-white cursor-pointer"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Journal & Scan Settings */}
        <section className="bg-white border border-[#e2e4ea] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
            <div className="flex items-center gap-2.5">
              <BrandexButtonIcon
                name="journalScan"
                variant="square"
                size={30}
                colorMode={universal.imageColorMode}
              />
              <h3 className="text-base font-extrabold text-[#111111]">
                Journal &amp; Scan Settings
              </h3>
            </div>
            <span className="text-xs font-mono text-[#555a66]">{config.serialPrefix}001</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-journal-no" className="block text-xs font-bold text-[#374151] mb-1.5">
                Journal No
              </label>
              <div className="relative">
                <input
                  id="settings-journal-no"
                  ref={journalNoInputRef}
                  type="text"
                  value={config.journalNo}
                  onChange={(e) => onUpdateConfig({ ...config, journalNo: e.target.value })}
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] pl-3 pr-8 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
                {config.journalNo && (
                  <button
                    type="button"
                    aria-label="Clear Journal No"
                    onClick={() => {
                      onUpdateConfig({ ...config, journalNo: '' });
                      journalNoInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#111111]"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="settings-journal-date" className="block text-xs font-bold text-[#374151] mb-1.5">
                Journal Date
              </label>
              <input
                id="settings-journal-date"
                type="text"
                value={config.journalDate}
                onChange={(e) => onUpdateConfig({ ...config, journalDate: e.target.value })}
                placeholder="26-Nov-2026"
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-match-mode" className="block text-xs font-bold text-[#374151] mb-1.5">
                Keyword Match Mode
              </label>
              <select
                id="settings-match-mode"
                value={config.keywordMatchMode}
                onChange={(e) =>
                  onUpdateConfig({
                    ...config,
                    keywordMatchMode: e.target.value as KeywordMatchMode,
                  })
                }
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm text-[#111111]"
              >
                <option value="word">Word Boundary</option>
                <option value="contains">Substring Contains</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="settings-serial-prefix" className="block text-xs font-bold text-[#374151] mb-1.5">
                  Serial Prefix
                </label>
                <input
                  id="settings-serial-prefix"
                  type="text"
                  value={config.serialPrefix}
                  onChange={(e) => onUpdateConfig({ ...config, serialPrefix: e.target.value })}
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm font-mono text-[#111111]"
                />
              </div>

              <div>
                <label htmlFor="settings-serial-pad" className="block text-xs font-bold text-[#374151] mb-1.5">
                  Serial Pad
                </label>
                <input
                  id="settings-serial-pad"
                  type="number"
                  min={1}
                  max={6}
                  value={config.serialPad}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      serialPad: Math.max(1, Math.min(6, Number(e.target.value) || 3)),
                    })
                  }
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm font-mono text-[#111111]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Database Mapping Settings */}
        <section className="bg-white border border-[#e2e4ea] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
            <div className="flex items-center gap-2.5">
              <BrandexButtonIcon
                name="databaseMapping"
                variant="square"
                size={30}
                colorMode={universal.imageColorMode}
              />
              <h3 className="text-base font-extrabold text-[#111111]">Database Mapping</h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#111111] bg-[#fffef0] border border-[#111111] px-2 py-0.5">
              {sepPreview}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="settings-sheet-id" className="block text-xs font-bold text-[#374151] mb-1.5">
                Google Sheet URL or ID
              </label>
              <input
                id="settings-sheet-id"
                type="text"
                value={sheetCfg.sheetUrlOrId}
                onChange={(e) => updateSheetConfig({ sheetUrlOrId: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-sheet-tab" className="block text-xs font-bold text-[#374151] mb-1.5">
                Sheet Tab Name
              </label>
              <input
                id="settings-sheet-tab"
                type="text"
                value={sheetCfg.sheetName}
                onChange={(e) => updateSheetConfig({ sheetName: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-case-sep" className="block text-xs font-bold text-[#374151] mb-1.5">
                Case Separator
              </label>
              <input
                id="settings-case-sep"
                type="text"
                value={sheetCfg.caseSeparator || '-'}
                onChange={(e) => updateSheetConfig({ caseSeparator: e.target.value || '-' })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-mono text-[#111111]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label htmlFor="settings-key-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                TM Col #
              </label>
              <input
                id="settings-key-col"
                type="number"
                min={1}
                value={sheetCfg.keyCol}
                onChange={(e) => updateSheetConfig({ keyCol: Math.max(1, Number(e.target.value) || 8) })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-prefix-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                Prefix Col #
              </label>
              <input
                id="settings-prefix-col"
                type="number"
                min={1}
                value={sheetCfg.prefixCol ?? 3}
                onChange={(e) =>
                  updateSheetConfig({ prefixCol: Math.max(1, Number(e.target.value) || 3) })
                }
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-code-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                Client Code Col #
              </label>
              <input
                id="settings-code-col"
                type="number"
                min={1}
                value={sheetCfg.clientCodeCol ?? 4}
                onChange={(e) =>
                  updateSheetConfig({ clientCodeCol: Math.max(1, Number(e.target.value) || 4) })
                }
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-case-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                Case No Col #
              </label>
              <input
                id="settings-case-col"
                type="number"
                min={1}
                value={sheetCfg.caseCol}
                onChange={(e) => updateSheetConfig({ caseCol: Math.max(1, Number(e.target.value) || 5) })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Defaults & Reset */}
      <section className="bg-white border border-[#e2e4ea] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-[#111111]">Watchlist &amp; Workspace</h3>
            <p className="text-xs text-[#555a66] mt-0.5 tabular-nums">
              {config.keywords.length} keywords · {config.tmNumbers.length} TMs · {config.caseEntries.length} rows
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleRestoreSeedWatchlist}
            className="h-[38px] px-4 border border-[#111111] bg-white hover:bg-[#f6f7f9] text-xs font-bold text-[#111111]"
          >
            Merge Seed Watchlist
          </button>
          <button
            type="button"
            onClick={onResetSampleData}
            className="h-[38px] px-4 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Sample Data</span>
          </button>
        </div>
      </section>

      {/* Branding Asset Kit (/branding) */}
      <section className="bg-white border border-[#e2e4ea] p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-[#eceef2] pb-4">
          <div className="flex items-center gap-3">
            <BrandexButtonIcon
              name="appYellow"
              variant="square"
              size={34}
              colorMode={universal.imageColorMode}
            />
            <div>
              <h3 className="text-base font-extrabold text-[#111111]">
                Branding Asset Kit (/branding)
              </h3>
              <p className="text-xs text-[#555a66] tabular-nums">
                {BRANDING_ASSETS.length} organized assets saved in /branding/logos, favicons, icons,
                buttons &amp; cards
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'logos', label: 'Logos' },
                { id: 'favicons', label: 'Favicons' },
                { id: 'icons', label: 'Icons' },
                { id: 'buttons', label: 'Buttons' },
                { id: 'cards', label: 'Business Cards' },
              ] as const
            ).map((tab) => {
              const active = assetCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-sfx="filter"
                  data-active={active}
                  onClick={() => setAssetCategory(tab.id)}
                  className={`builty-filter-btn h-[32px] px-3 border text-xs font-bold inline-flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#ffee00] border-[#111111] text-[#111111]'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66] hover:text-[#111111]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="font-mono text-[10.5px] opacity-80">
                    {categoryCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleBrandingAssets.map((item) => {
            const isCircle = item.cropMode === 'circle';
            const isSquare = item.cropMode === 'square';
            const isPlaque = item.cropMode === 'plaque';
            const grayscaleClass =
              universal.imageColorMode === 'grayscale' ? 'grayscale contrast-110' : '';

            return (
              <div
                key={item.id}
                className="border border-[#e2e4ea] bg-[#f8f9fb] flex flex-col justify-between"
              >
                <div className="h-[132px] bg-white border-b border-[#eceef2] p-3 flex items-center justify-center overflow-hidden">
                  {isCircle ? (
                    <span className="w-[88px] h-[88px] rounded-full overflow-hidden bg-[#111111] inline-flex items-center justify-center">
                      <img
                        src={item.src}
                        alt={item.label}
                        loading="lazy"
                        className={`w-full h-full object-cover scale-[1.52] ${grayscaleClass}`}
                      />
                    </span>
                  ) : isSquare ? (
                    <span className="w-[88px] h-[88px] rounded-[8px] overflow-hidden bg-[#111111] inline-flex items-center justify-center">
                      <img
                        src={item.src}
                        alt={item.label}
                        loading="lazy"
                        className={`w-full h-full object-cover scale-[1.50] ${grayscaleClass}`}
                      />
                    </span>
                  ) : isPlaque ? (
                    <span className="w-[210px] h-[52px] rounded-[6px] overflow-hidden border border-[#111111] bg-[#111111] inline-flex items-center justify-center">
                      <img
                        src={item.src}
                        alt={item.label}
                        loading="lazy"
                        className={`w-full h-full object-cover scale-[1.16] ${grayscaleClass}`}
                      />
                    </span>
                  ) : (
                    <img
                      src={item.src}
                      alt={item.label}
                      loading="lazy"
                      className={`max-h-full max-w-full object-contain ${grayscaleClass}`}
                    />
                  )}
                </div>

                <div className="p-3 space-y-2">
                  <div>
                    <div className="text-xs font-extrabold text-[#111111] truncate" title={item.label}>
                      {item.label}
                    </div>
                    <div
                      className="text-[10.5px] font-mono text-[#555a66] truncate mt-0.5"
                      title={item.brandingPath}
                    >
                      {item.brandingPath}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#e2e4ea]">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 bg-white border border-[#cbd0da] text-[#374151]">
                      {item.category}
                    </span>
                    <a
                      href={item.brandingPath}
                      download={item.fileName}
                      className="h-[26px] px-2.5 bg-[#111111] text-[#ffee00] hover:bg-[#2a2f3a] text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" aria-hidden="true" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
