import { useId } from 'react';

export type BrandexLogoVariant =
  | 'logoFinal'
  | 'logo17'
  | 'logo17Icon'
  | 'logo01'
  | 'logo02'
  | 'logo03'
  | 'logo06'
  | 'logo09'
  | 'logo20';

interface BrandexLogoProps {
  variant?: BrandexLogoVariant;
  primaryColor?: string;
  accentColor?: string;
  discColor?: string;
  onDark?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function getContrastText(hexColor: string): string {
  const hex = hexColor.replace('#', '').trim();
  if (hex.length !== 6 && hex.length !== 3) return '#ffffff';
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#ffffff';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.64 ? '#111111' : '#ffffff';
}

/**
 * Ensures dark theme primary colors stay clearly legible over dark surfaces.
 */
export function resolveOnDarkPrimary(hexColor: string): string {
  const hex = hexColor.replace('#', '').trim();
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length !== 6) return '#8b5cf6';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#8b5cf6';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance >= 0.28) return hexColor;
  const mix = (c: number, target: number) =>
    Math.min(255, Math.round(c + (target - c) * 0.52))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r, 155)}${mix(g, 115)}${mix(b, 255)}`;
}

/**
 * Builds the exact circular b(R) favicon/badge SVG matching the user's uploaded circular emblem,
 * with themeable disc & gold/accent colors.
 */
export function buildLogo17IconSvgString(
  discColor = '#111111',
  markColor = '#f5c400',
  roundedSquare = false
): string {
  const outerShape = roundedSquare
    ? `<rect x="4" y="4" width="92" height="92" rx="22" fill="${discColor}" stroke="#26262b" stroke-width="1.5" />`
    : `<circle cx="50" cy="50" r="48" fill="${discColor}" stroke="#26262b" stroke-width="1.2" />
       <circle cx="50" cy="50" r="42" stroke="${markColor}" stroke-width="2.7" fill="none" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    ${outerShape}
    <path d="M30 30.5 C34.5 29.8 38.5 27.6 41.8 25 L41.8 70.2 C41.8 71.8 39.2 72.5 36.2 72.5 L36.2 33.2 L30 32 Z" fill="${markColor}" />
    <circle cx="52.5" cy="55.5" r="17" fill="${markColor}" />
    <circle cx="52.5" cy="55.5" r="12.8" fill="${discColor}" />
    <circle cx="52.5" cy="55.5" r="10.4" fill="${markColor}" />
    <text x="52.4" y="61.2" text-anchor="middle" fill="${discColor}" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-weight="500">R</text>
  </svg>`;
}

/**
 * Generates an inline SVG string for Logo-Final (GET LEGAL + b(R)andex + ®)
 * preserving the exact design of Logo-Final.JPG with themeable colors.
 */
export function buildLogoFinalSvgString(
  primaryColor = '#290076',
  accentColor = '#f4580b',
  getLegalColor?: string,
  heightPx = 50
): string {
  const topColor = getLegalColor || primaryColor;
  const rText = getContrastText(accentColor);
  return `<svg height="${heightPx}" viewBox="0 0 286 86" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="140" y="21" text-anchor="middle" fill="${topColor}" font-family="Georgia, 'Times New Roman', serif" font-size="11.5" font-weight="500" letter-spacing="5.5">GET LEGAL</text>
    <circle cx="262" cy="15" r="9.5" stroke="${topColor}" stroke-width="1.5" fill="none" />
    <text x="262" y="19.2" text-anchor="middle" fill="${topColor}" font-family="Georgia, 'Times New Roman', serif" font-size="12" font-weight="600">R</text>
    <text x="8" y="68" fill="${primaryColor}" font-family="Georgia, 'Times New Roman', serif" font-size="54" font-weight="500">b</text>
    <circle cx="64" cy="52" r="20.5" fill="${accentColor}" />
    <text x="62" y="62.5" text-anchor="middle" fill="${rText}" font-family="Georgia, 'Times New Roman', serif" font-size="31" font-weight="500">R</text>
    <path d="M68 60 C72 67 77 70 82 70" stroke="${rText}" stroke-width="2.1" stroke-linecap="round" />
    <text x="89" y="68" fill="${primaryColor}" font-family="Georgia, 'Times New Roman', serif" font-size="54" font-weight="500" letter-spacing="-1">andex</text>
  </svg>`;
}

export function BrandexLogo({
  variant = 'logoFinal',
  primaryColor,
  accentColor = '#f4580b',
  discColor = '#111111',
  onDark = false,
  className = '',
  size = 'md',
}: BrandexLogoProps) {
  useId();
  const rawPrimary = primaryColor || '#290076';
  const primary = onDark ? resolveOnDarkPrimary(rawPrimary) : rawPrimary;
  const topTextColor = onDark ? '#ffffff' : rawPrimary;
  const accent = accentColor || '#f4580b';
  const rTextColor = getContrastText(accent);

  const heightMap = {
    xs: 24,
    sm: 32,
    md: 42,
    lg: 56,
    xl: 70,
  };
  const h = heightMap[size];

  // Circular b(R) Badge Icon (exact uploaded circular emblem, theme-synced)
  if (variant === 'logo17Icon' || variant === 'logo03') {
    const badgeMark = accentColor || '#f5c400';
    const badgeDisc = discColor || '#111111';
    return (
      <svg
        width={h}
        height={h}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex Circular b(R) Icon"
      >
        <circle cx="50" cy="50" r="48" fill={badgeDisc} stroke="#2a2a30" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="42" stroke={badgeMark} strokeWidth="2.7" fill="none" />
        {/* Stylized 'b' stem with angled top-left serif */}
        <path
          d="M30 30.5 C34.5 29.8 38.5 27.6 41.8 25 L41.8 70.2 C41.8 71.8 39.2 72.5 36.2 72.5 L36.2 33.2 L30 32 Z"
          fill={badgeMark}
        />
        {/* Bowl + cutout ring + inner circle + serif R */}
        <circle cx="52.5" cy="55.5" r="17" fill={badgeMark} />
        <circle cx="52.5" cy="55.5" r="12.8" fill={badgeDisc} />
        <circle cx="52.5" cy="55.5" r="10.4" fill={badgeMark} />
        <text
          x="52.4"
          y="61.2"
          textAnchor="middle"
          fill={badgeDisc}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="16"
          fontWeight="500"
        >
          R
        </text>
      </svg>
    );
  }

  // Rounded-Square App Icon variant (matching App_favicon_icon_in_yellow)
  if (variant === 'logo09') {
    const badgeMark = accentColor || '#f5c400';
    const badgeDisc = discColor || '#111111';
    return (
      <svg
        width={h}
        height={h}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex App Icon"
      >
        <rect x="4" y="4" width="92" height="92" rx="22" fill={badgeDisc} stroke="#2a2a30" strokeWidth="1.5" />
        <path
          d="M30 30.5 C34.5 29.8 38.5 27.6 41.8 25 L41.8 70.2 C41.8 71.8 39.2 72.5 36.2 72.5 L36.2 33.2 L30 32 Z"
          fill={badgeMark}
        />
        <circle cx="52.5" cy="55.5" r="17" fill={badgeMark} />
        <circle cx="52.5" cy="55.5" r="12.8" fill={badgeDisc} />
        <circle cx="52.5" cy="55.5" r="10.4" fill={badgeMark} />
        <text
          x="52.4"
          y="61.2"
          textAnchor="middle"
          fill={badgeDisc}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="16"
          fontWeight="500"
        >
          R
        </text>
      </svg>
    );
  }

  // Circular b(R) Emblem + "brandex" wordmark lockup
  if (variant === 'logo17' || variant === 'logo06') {
    const badgeMark = accentColor || '#f5c400';
    const badgeDisc = discColor || '#111111';
    const lockupSize = h * 1.25;
    return (
      <svg
        width={lockupSize}
        height={lockupSize}
        viewBox="0 0 120 124"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex Circular Seal + Wordmark"
      >
        <g transform="translate(10, 0) scale(0.92)">
          <circle cx="54" cy="48" r="46" fill={badgeDisc} stroke="#2a2a30" strokeWidth="1.2" />
          <circle cx="54" cy="48" r="40" stroke={badgeMark} strokeWidth="2.7" fill="none" />
          <path
            d="M34 28.5 C38.5 27.8 42.5 25.6 45.8 23 L45.8 68.2 C45.8 69.8 43.2 70.5 40.2 70.5 L40.2 31.2 L34 30 Z"
            fill={badgeMark}
          />
          <circle cx="56.5" cy="53.5" r="17" fill={badgeMark} />
          <circle cx="56.5" cy="53.5" r="12.8" fill={badgeDisc} />
          <circle cx="56.5" cy="53.5" r="10.4" fill={badgeMark} />
          <text
            x="56.4"
            y="59.2"
            textAnchor="middle"
            fill={badgeDisc}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="16"
            fontWeight="500"
          >
            R
          </text>
        </g>
        <text
          x="60"
          y="112"
          textAnchor="middle"
          fill={onDark ? '#ffffff' : primary}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="15.5"
          fontWeight="600"
          letterSpacing="3.4"
        >
          brandex
        </text>
      </svg>
    );
  }

  // Default & Primary Logo: exact Logo-Final design (GET LEGAL + ® + b(R)andex) with theme-replaced colors
  return (
    <svg
      height={h}
      viewBox="0 0 286 86"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Brandex Get Legal Logo"
    >
      {/* GET LEGAL centered above */}
      <text
        x="140"
        y="21"
        textAnchor="middle"
        fill={topTextColor}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="11.5"
        fontWeight="500"
        letterSpacing="5.5"
      >
        GET LEGAL
      </text>

      {/* Registered Trademark ® badge top-right */}
      <circle cx="262" cy="15" r="9.5" stroke={topTextColor} strokeWidth="1.5" fill="none" />
      <text
        x="262"
        y="19.2"
        textAnchor="middle"
        fill={topTextColor}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="12"
        fontWeight="600"
      >
        R
      </text>

      {/* Editorial serif 'b' */}
      <text
        x="8"
        y="68"
        fill={primary}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="54"
        fontWeight="500"
      >
        b
      </text>

      {/* Accent circle with crisp 'R' and graceful leg tail */}
      <circle cx="64" cy="52" r="20.5" fill={accent} />
      <text
        x="62"
        y="62.5"
        textAnchor="middle"
        fill={rTextColor}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="31"
        fontWeight="500"
      >
        R
      </text>
      <path
        d="M68 60 C72 67 77 70 82 70"
        stroke={rTextColor}
        strokeWidth="2.1"
        strokeLinecap="round"
      />

      {/* Editorial serif 'andex' */}
      <text
        x="89"
        y="68"
        fill={primary}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="54"
        fontWeight="500"
        letterSpacing="-1"
      >
        andex
      </text>
    </svg>
  );
}
