import {
  GeneratedJournalDoc,
  PaperSizeConfig,
  PaperSizePreset,
  UniversalSettings,
} from '../../types/journal';
import {
  buildLogo17IconSvgString,
  buildLogoFinalSvgString,
} from '../../components/BrandexLogo';

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface StandardPaperDefinition {
  id: Exclude<PaperSizePreset, 'custom'>;
  label: string;
  widthIn: number;
  heightIn: number;
  dimensionsLabel: string;
}

export const STANDARD_PAPER_SIZES: StandardPaperDefinition[] = [
  {
    id: 'legal',
    label: 'Legal',
    widthIn: 8.5,
    heightIn: 14,
    dimensionsLabel: '8.5 × 14 in',
  },
  {
    id: 'a4',
    label: 'A4',
    widthIn: 8.27,
    heightIn: 11.69,
    dimensionsLabel: '210 × 297 mm',
  },
  {
    id: 'letter',
    label: 'Letter',
    widthIn: 8.5,
    heightIn: 11,
    dimensionsLabel: '8.5 × 11 in',
  },
  {
    id: 'a5',
    label: 'A5',
    widthIn: 5.83,
    heightIn: 8.27,
    dimensionsLabel: '148 × 210 mm',
  },
  {
    id: 'a3',
    label: 'A3',
    widthIn: 11.69,
    heightIn: 16.54,
    dimensionsLabel: '297 × 420 mm',
  },
  {
    id: 'tabloid',
    label: 'Tabloid',
    widthIn: 11,
    heightIn: 17,
    dimensionsLabel: '11 × 17 in',
  },
  {
    id: 'executive',
    label: 'Executive',
    widthIn: 7.25,
    heightIn: 10.5,
    dimensionsLabel: '7.25 × 10.5 in',
  },
];

export const DEFAULT_PAPER_SIZE: PaperSizeConfig = {
  preset: 'legal',
  orientation: 'portrait',
  customWidth: 8.5,
  customHeight: 14,
  customUnit: 'in',
};

export interface ResolvedPaperDimensions {
  widthIn: number;
  heightIn: number;
  label: string;
  presetName: string;
  orientation: 'portrait' | 'landscape';
  compactLayout: boolean;
  maxImageHeightIn: number;
}

export function resolvePaperDimensionsIn(paperSize?: PaperSizeConfig): ResolvedPaperDimensions {
  const cfg = paperSize || DEFAULT_PAPER_SIZE;

  let baseW = 8.5;
  let baseH = 14;
  let presetName = 'Legal';

  if (cfg.preset === 'custom') {
    const unitFactor = cfg.customUnit === 'mm' ? 1 / 25.4 : 1;
    const rawW = Number(cfg.customWidth) || 8.5;
    const rawH = Number(cfg.customHeight) || 14;
    baseW = Math.min(30, Math.max(3, Number((rawW * unitFactor).toFixed(2))));
    baseH = Math.min(36, Math.max(3, Number((rawH * unitFactor).toFixed(2))));
    presetName = 'Custom';
  } else {
    const match = STANDARD_PAPER_SIZES.find((p) => p.id === cfg.preset) || STANDARD_PAPER_SIZES[0];
    baseW = match.widthIn;
    baseH = match.heightIn;
    presetName = match.label;
  }

  const isLandscape = cfg.orientation === 'landscape';
  const widthIn = isLandscape ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
  const heightIn = isLandscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH);

  const label =
    cfg.preset === 'custom' && cfg.customUnit === 'mm'
      ? `Custom ${Math.round((isLandscape ? Math.max(cfg.customWidth, cfg.customHeight) : Math.min(cfg.customWidth, cfg.customHeight)) || 216)}×${Math.round((isLandscape ? Math.min(cfg.customWidth, cfg.customHeight) : Math.max(cfg.customWidth, cfg.customHeight)) || 356)} mm`
      : `${presetName} ${widthIn}×${heightIn} in${isLandscape ? ' Landscape' : ''}`;

  const compactLayout = heightIn < 11.2 || widthIn < 7.5;
  const maxImageHeightIn = Math.max(1.2, Number((heightIn - 7.8).toFixed(2)));

  return {
    widthIn: Number(widthIn.toFixed(2)),
    heightIn: Number(heightIn.toFixed(2)),
    label,
    presetName,
    orientation: cfg.orientation || 'portrait',
    compactLayout,
    maxImageHeightIn,
  };
}

export function buildJournal909Html(
  doc: GeneratedJournalDoc,
  paperSize?: PaperSizeConfig,
  universalSettings?: UniversalSettings
): string {
  const safeJournalNo = esc(doc.journalNo || '909');
  const safeJournalDate = esc(doc.journalDate || '26-Nov-2026');
  const safePubDetails = esc(doc.publishingDetails).replace(/\n/g, '<br />');
  const safeTitle = esc(doc.title);
  const safeTrademark = esc(doc.trademarkField || doc.applicationNo);
  const safeClass = esc(doc.classNo);
  const safeExtraValue = esc(doc.extraValue);
  const safeExtraLabel = esc(doc.extraLabel);
  const safeNote = esc(
    doc.noteText || 'NOTE: DEMAND NOTE WILL BE ISSUED AFTER 2 MONTHS FROM THE DATE OF PUBLICATION'
  );

  const themePrimary = universalSettings?.docPrimaryColor || '#290076';
  const themeSecondary = universalSettings?.docSecondaryColor || '#4e1cb8';
  const themeAccent = universalSettings?.docAccentColor || '#f4580b';
  const colorMode = doc.imageColorMode || universalSettings?.imageColorMode || 'theme';

  const dims = resolvePaperDimensionsIn(paperSize);
  const contentPad = dims.compactLayout
    ? '0.42in 0.42in 0.34in 0.42in'
    : '0.62in 0.56in 0.48in 0.56in';

  const extraRowsHtml = (doc.extraRows || [])
    .map(
      (r) => `
          <tr>
            <td class="label-cell">${esc(r.label || 'DETAIL')}</td>
            <td class="value-cell" colspan="3" contenteditable="true">${esc(r.value)}</td>
          </tr>`
    )
    .join('');

  const imgStyle = `max-width:100%;max-height:${dims.maxImageHeightIn}in;object-fit:contain;${
    colorMode === 'grayscale' ? 'filter:grayscale(100%) contrast(1.12);' : ''
  }`;
  const imageHtml = doc.imageDataUrl
    ? colorMode === 'theme'
      ? `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;"><img src="${doc.imageDataUrl}" alt="${safeTitle || 'Trademark artwork'}" style="${imgStyle}" /><div style="position:absolute;inset:0;background:${themePrimary};mix-blend-mode:color;opacity:0.85;pointer-events:none;"></div></div>`
      : `<img src="${doc.imageDataUrl}" alt="${safeTitle || 'Trademark artwork'}" style="${imgStyle}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Journal ${safeJournalNo} - ${safeTitle || esc(doc.applicationNo)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Exo+2:wght@400;500;600;700&family=Orbitron:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --theme: ${themePrimary};
      --theme-light: ${themeSecondary};
      --heading: ${themeAccent};
      --silver-dark: #a6a6a6;
      --silver-mid: #d4d4d4;
      --font-display: "Orbitron", sans-serif;
      --font-tech: "Chakra Petch", sans-serif;
      --font-body: "Exo 2", sans-serif;
    }
    @page { size: ${dims.widthIn}in ${dims.heightIn}in; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #e5e5e5; font-family: var(--font-body); }
    .page { position: relative; width: ${dims.widthIn}in; height: ${dims.heightIn}in; margin: 0 auto; background: #ffffff; overflow: hidden; display: flex; flex-direction: column; }
    @media screen { .page { margin: 20px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.25); } }
    @media print { body { background: #ffffff; } .page { margin: 0; box-shadow: none; } }
    .frame-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
    .content { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; padding: ${contentPad}; }
    .top-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.18in; }
    .brand-left { display: flex; align-items: center; gap: 0.22in; padding-left: 0.08in; }
    .pub-tag { width: ${dims.compactLayout ? '0.92in' : '1.18in'}; height: ${dims.compactLayout ? '1.3in' : '1.65in'}; flex-shrink: 0; }
    .journal-info { border-left: 2px solid var(--theme); padding-left: 0.18in; padding-top: 0.02in; }
    .journal-title { margin: 0; font-family: var(--font-display); font-size: ${dims.compactLayout ? '16pt' : '20pt'}; font-weight: 800; letter-spacing: 1px; color: var(--heading); line-height: 1.15; }
    .journal-date { margin: 5px 0 11px 0; font-family: var(--font-tech); font-size: ${dims.compactLayout ? '11.5pt' : '13.5pt'}; font-weight: 700; letter-spacing: 2px; color: var(--theme); }
    .accent-bar-wrap { display: flex; align-items: center; gap: 6px; }
    .accent-bar { height: 6px; width: ${dims.compactLayout ? '1.5in' : '2.2in'}; background: linear-gradient(90deg, var(--theme-light) 0%, var(--theme-light) 34%, var(--theme) 34%, var(--theme) 100%); clip-path: polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%); }
    .slashes { display: inline-flex; gap: 4px; align-items: center; }
    .slashes span { display: inline-block; width: 6px; height: 12px; transform: skewX(-32deg); }
    .slashes-silver span:nth-child(1) { background: var(--theme); }
    .slashes-silver span:nth-child(2) { background: var(--silver-dark); }
    .slashes-silver span:nth-child(3) { background: var(--silver-mid); }
    .pub-details-wrap { width: ${dims.compactLayout ? '2.15in' : '2.65in'}; display: flex; flex-direction: column; align-items: stretch; margin-top: 0.08in; }
    .banner-row { display: flex; align-items: center; gap: 5px; }
    .banner-slashes { display: flex; gap: 4px; }
    .banner-slashes span { display: block; width: 9px; height: 28px; background: var(--theme); transform: skewX(-30deg); }
    .banner-slashes span.light { background: var(--theme-light); }
    .banner-box { flex: 1; height: 28px; background: var(--theme); color: var(--heading); font-family: var(--font-tech); font-size: 11pt; font-weight: 700; letter-spacing: 1.2px; display: flex; align-items: center; justify-content: center; text-transform: uppercase; clip-path: polygon(16px 0, 100% 0, 100% 100%, 0 100%); padding-left: 12px; }
    .pub-details-input { margin-top: 8px; min-height: 0.72in; border: 2px solid var(--theme); padding: 6px 8px; font-family: var(--font-body); font-size: 9.5pt; color: #111; outline: none; }
    .app-section { margin-top: ${dims.compactLayout ? '0.18in' : '0.28in'}; }
    .app-header { display: flex; align-items: center; gap: 8px; margin-bottom: 0.14in; }
    .app-banner { display: flex; align-items: center; gap: 5px; }
    .app-banner-box { height: 30px; background: var(--theme); color: var(--heading); font-family: var(--font-tech); font-size: 12pt; font-weight: 700; letter-spacing: 1.2px; display: flex; align-items: center; padding: 0 28px 0 22px; text-transform: uppercase; clip-path: polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%); }
    .app-line { flex: 1; height: 2px; background: var(--theme); }
    .details-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 2px solid var(--theme); }
    .details-table td { border: 1.5px solid var(--theme); height: ${dims.compactLayout ? '0.36in' : '0.44in'}; padding: 4px 10px; font-family: var(--font-body); font-size: 11pt; vertical-align: middle; }
    .details-table td.label-cell { background: linear-gradient(90deg, #bdbdbd 0%, #efefef 52%, #bdbdbd 100%); color: #000000; font-family: var(--font-tech); font-size: 11.5pt; font-weight: 700; text-align: center; letter-spacing: 0.8px; }
    .details-table td.value-cell { background: #ffffff; color: #111111; outline: none; }
    .image-header { margin-top: ${dims.compactLayout ? '0.18in' : '0.28in'}; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .image-line { flex: 1; max-width: 1.8in; height: 2px; background: var(--theme); }
    .image-title { margin: 0; padding: 0 12px; font-family: var(--font-display); font-size: 15.5pt; font-weight: 800; letter-spacing: 2px; color: var(--heading); text-transform: uppercase; }
    .image-area { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; padding: 0.16in 0; min-height: 1.4in; }
    .image-stamp { position: absolute; right: 8px; bottom: 8px; width: 64px; height: 64px; opacity: 0.9; pointer-events: none; }
    .footer { margin-top: auto; }
    .note-bar { background: var(--theme); color: #ffffff; text-align: center; font-family: var(--font-tech); font-size: 9pt; font-weight: 600; letter-spacing: 0.8px; padding: 6px 10px; text-transform: uppercase; }
    .brandex-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 0.12in 0 0.1in 0; }
    .brandex-line { width: 0.9in; height: 1.5px; background: var(--theme); }
    .contact-row { display: flex; align-items: center; justify-content: space-between; font-family: var(--font-body); font-size: 7.2pt; color: #111111; padding: 0 0.05in; }
    .contact-item { display: flex; align-items: center; gap: 6px; padding: 0 8px; border-right: 1.5px solid var(--theme); }
    .contact-item:first-child { padding-left: 0; max-width: 2.25in; }
    .contact-item:last-child { border-right: none; padding-right: 0; }
    .contact-icon { width: 20px; height: 20px; flex-shrink: 0; }
    .contact-label { font-family: var(--font-tech); font-weight: 700; color: var(--theme); font-size: 8pt; letter-spacing: 0.4px; display: block; margin-bottom: 1px; }
    .contact-text { line-height: 1.25; }
  </style>
</head>
<body>
  <div class="page">
    <svg class="frame-svg" viewBox="0 0 850 1400" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,18 98,18 18,98" fill="${themeSecondary}" />
      <polygon points="18,108 108,18 134,18 18,134" fill="${themePrimary}" />
      <polygon points="776,18 832,18 832,74" fill="${themePrimary}" />
      <polygon points="750,18 766,18 832,84 832,100" fill="#b8b8b8" />
      <polygon points="18,1326 18,1382 74,1382" fill="${themePrimary}" />
      <polygon points="18,1300 18,1316 84,1382 100,1382" fill="#b8b8b8" />
      <polygon points="752,1382 832,1382 832,1302" fill="${themeSecondary}" />
      <polygon points="726,1382 742,1382 832,1292 832,1276" fill="${themePrimary}" />
      <line x1="138" y1="22" x2="742" y2="22" stroke="#b8b8b8" stroke-width="2" />
      <line x1="120" y1="32" x2="764" y2="32" stroke="${themePrimary}" stroke-width="4" />
      <line x1="86" y1="1368" x2="730" y2="1368" stroke="${themePrimary}" stroke-width="4" />
      <line x1="108" y1="1378" x2="712" y2="1378" stroke="#b8b8b8" stroke-width="2" />
      <line x1="20" y1="145" x2="20" y2="495" stroke="${themePrimary}" stroke-width="3" />
      <line x1="20" y1="530" x2="20" y2="660" stroke="${themeSecondary}" stroke-width="5" />
      <line x1="20" y1="680" x2="20" y2="715" stroke="${themePrimary}" stroke-width="5" />
      <line x1="20" y1="735" x2="20" y2="1285" stroke="#b8b8b8" stroke-width="2" />
      <line x1="28" y1="125" x2="28" y2="1305" stroke="${themePrimary}" stroke-width="2" />
      <line x1="830" y1="115" x2="830" y2="500" stroke="#b8b8b8" stroke-width="2" />
      <line x1="830" y1="530" x2="830" y2="660" stroke="${themeSecondary}" stroke-width="5" />
      <line x1="830" y1="680" x2="830" y2="715" stroke="${themePrimary}" stroke-width="5" />
      <line x1="830" y1="735" x2="830" y2="1265" stroke="${themePrimary}" stroke-width="3" />
      <line x1="822" y1="95" x2="822" y2="1285" stroke="${themePrimary}" stroke-width="2" />
    </svg>
    <div class="content">
      <div class="top-header">
        <div class="brand-left">
          <svg class="pub-tag" viewBox="0 0 120 165" xmlns="http://www.w3.org/2000/svg">
            <path d="M22,2 L118,2 L118,162 L60,130 L2,162 L2,22 Z" fill="${themePrimary}" />
            <path d="M6,154 L60,124 L114,154" fill="none" stroke="#ffffff" stroke-width="1.5" />
            <circle cx="60" cy="14" r="5" fill="#ffffff" />
            <text x="60" y="75" text-anchor="middle" fill="#ffffff" font-family="Orbitron, sans-serif" font-size="27" font-weight="700">${safeJournalNo}</text>
            <line x1="26" y1="84" x2="94" y2="84" stroke="#ffffff" stroke-width="1" />
            <text x="60" y="103" text-anchor="middle" fill="#ffffff" font-family="Chakra Petch, sans-serif" font-size="13.5" font-weight="600" letter-spacing="0.5">Publication</text>
          </svg>
          <div class="journal-info">
            <h1 class="journal-title">JOURNAL ${safeJournalNo}</h1>
            <div class="journal-date">${safeJournalDate}</div>
            <div class="accent-bar-wrap">
              <div class="accent-bar"></div>
              <div class="slashes slashes-silver"><span></span><span></span><span></span></div>
            </div>
          </div>
        </div>
        <div class="pub-details-wrap">
          <div class="banner-row">
            <div class="banner-slashes"><span></span></div>
            <div class="banner-box">PUBLISHING DETAILS</div>
          </div>
          <div class="pub-details-input" contenteditable="true">${safePubDetails}</div>
        </div>
      </div>
      <div class="app-section">
        <div class="app-header">
          <div class="app-banner">
            <div class="banner-slashes"><span class="light"></span></div>
            <div class="app-banner-box">APPLICATION DETAILS</div>
          </div>
          <div class="app-line"></div>
          <div class="slashes slashes-silver"><span></span><span></span><span></span></div>
        </div>
        <table class="details-table">
          <colgroup>
            <col style="width: 13%;" />
            <col style="width: 40%;" />
            <col style="width: 18%;" />
            <col style="width: 29%;" />
          </colgroup>
          <tr>
            <td class="label-cell">TITLE</td>
            <td class="value-cell" contenteditable="true">${safeTitle}</td>
            <td class="label-cell">TRADEMARK</td>
            <td class="value-cell" contenteditable="true">${safeTrademark}</td>
          </tr>
          <tr>
            <td class="label-cell">CLASS</td>
            <td class="value-cell" contenteditable="true">${safeClass}</td>
            <td class="label-cell">${safeExtraLabel}</td>
            <td class="value-cell" contenteditable="true">${safeExtraValue}</td>
          </tr>${extraRowsHtml}
        </table>
      </div>
      <div class="image-header">
        <div class="image-line"></div>
        <div class="slashes">
          <span style="background: ${themeSecondary};"></span>
          <span style="background: #b8b8b8;"></span>
          <span style="background: ${themePrimary};"></span>
        </div>
        <h2 class="image-title">IMAGE</h2>
        <div class="slashes">
          <span style="background: ${themePrimary};"></span>
          <span style="background: ${themeSecondary};"></span>
          <span style="background: #b8b8b8;"></span>
        </div>
        <div class="image-line"></div>
      </div>
      <div class="image-area" contenteditable="true">${imageHtml}<div class="image-stamp">${buildLogo17IconSvgString(themePrimary, themeAccent, '#ffffff')}</div></div>
      <div class="footer">
        <div class="note-bar">${safeNote}</div>
        <div class="brandex-row">
          <div class="brandex-line"></div>
          ${buildLogoFinalSvgString(themePrimary, themeAccent, themePrimary, 46)}
          <div class="brandex-line"></div>
        </div>
        <div class="contact-row">
          <div class="contact-item">
            <svg class="contact-icon" viewBox="0 0 24 24" fill="${themePrimary}" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
            <div class="contact-text"><span class="contact-label">Address:</span>DROP AT ABDULLAH CENTRE, JINNAH COLONY BEHIND PTCL EXCHANGE, TARLAI, ISLAMABAD</div>
          </div>
          <div class="contact-item">
            <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="${themePrimary}" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-8.66 15l-1.1 4 4.1-1.08A10 10 0 1 0 12 2z"/><path d="M9.5 8.5c.3-.6.7-.6 1-.6h.5c.2 0 .5.1.6.5l.7 1.6c.1.3 0 .5-.2.7l-.5.6c.6 1 1.5 1.9 2.5 2.5l.6-.5c.2-.2.4-.3.7-.2l1.6.7c.4.1.5.4.5.6v.5c0 .3 0 .7-.6 1-.5.3-1.4.4-2.5 0-1.6-.6-3.7-2.6-4.4-4.3-.4-1.1-.3-2 .1-2.6z" fill="${themePrimary}" stroke="none"/></svg>
            <div class="contact-text"><span class="contact-label">Whatsapp:</span>+92 336 0015004</div>
          </div>
          <div class="contact-item">
            <svg class="contact-icon" viewBox="0 0 24 24" fill="${themePrimary}" xmlns="http://www.w3.org/2000/svg"><path d="M2 5h20v14H2V5zm2 2v.4l8 5.2 8-5.2V7H4zm16 10V9.7l-8 5.2-8-5.2V17h16z"/></svg>
            <div class="contact-text"><span class="contact-label">Email:</span>info@brandex.pk</div>
          </div>
          <div class="contact-item">
            <svg class="contact-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10.5" fill="${themePrimary}"/><path d="M13.5 19v-6h2l.3-2.3h-2.3V9.3c0-.7.2-1.1 1.2-1.1h1.2V6.1c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.6H9v2.3h2.1v6h2.4z" fill="#ffffff"/></svg>
            <div class="contact-text"><span class="contact-label">Facebook:</span>https://www.facebook.com/<br/>Brandex.pk/</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildJournal909WordDoc(
  doc: GeneratedJournalDoc,
  paperSize?: PaperSizeConfig,
  universalSettings?: UniversalSettings
): string {
  const dims = resolvePaperDimensionsIn(paperSize);
  const themePrimary = universalSettings?.docPrimaryColor || '#290076';
  const themeAccent = universalSettings?.docAccentColor || '#f4580b';
  const imageTag = doc.imageDataUrl
    ? `<div style="text-align:center;margin:24px 0;"><img src="${doc.imageDataUrl}" style="max-width:460px;max-height:420px;" /></div>`
    : '<p style="text-align:center;color:#777;">[Artwork Space]</p>';

  const extraRowsWord = (doc.extraRows || [])
    .map(
      (r) =>
        `<tr><td class="lbl">${esc(r.label || 'DETAIL')}</td><td colspan="3">${esc(r.value)}</td></tr>`
    )
    .join('');

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /><title>Journal ${esc(doc.journalNo)} - ${esc(doc.title)}</title>
<style>
  @page Section1 { size: ${dims.widthIn}in ${dims.heightIn}in; margin: 0.5in; }
  div.Section1 { page: Section1; }
  body { font-family: Arial, sans-serif; color: #111; }
  h1 { color: ${themeAccent}; font-size: 20pt; margin-bottom: 4pt; }
  h2 { color: ${themePrimary}; font-size: 13pt; margin-top: 14pt; }
  table { width: 100%; border-collapse: collapse; border: 2px solid ${themePrimary}; }
  td { border: 1px solid ${themePrimary}; padding: 6pt 8pt; font-size: 10.5pt; }
  td.lbl { background: #e5e5e5; font-weight: bold; width: 18%; }
</style>
</head>
<body>
  <div class="Section1">
    <h1>JOURNAL ${esc(doc.journalNo)} — ${esc(doc.journalDate)}</h1>
    <p><strong>Publishing Details:</strong> ${esc(doc.publishingDetails)}</p>
    <h2>APPLICATION DETAILS</h2>
    <table>
      <tr>
        <td class="lbl">TITLE</td><td>${esc(doc.title)}</td>
        <td class="lbl">TRADEMARK</td><td>${esc(doc.trademarkField || doc.applicationNo)}</td>
      </tr>
      <tr>
        <td class="lbl">CLASS</td><td>${esc(doc.classNo)}</td>
        <td class="lbl">${esc(doc.extraLabel || 'PAGE NO')}</td><td>${esc(doc.extraValue)}</td>
      </tr>
      ${extraRowsWord}
    </table>
    <h2>IMAGE</h2>
    ${imageTag}
    <p style="background:${themePrimary};color:#fff;padding:6pt;text-align:center;font-size:9pt;">
      ${esc(doc.noteText || 'NOTE: DEMAND NOTE WILL BE ISSUED AFTER 2 MONTHS FROM THE DATE OF PUBLICATION')}
    </p>
    <p style="text-align:center;font-size:9pt;color:${themePrimary};">GET LEGAL — bRandEx | +92 336 0015004 | info@brandex.pk</p>
  </div>
</body>
</html>`;
}
