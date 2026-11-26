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
 * Ensures dark theme primary colors (like #290076 or #111111) stay clearly legible
 * when rendered over a dark background (#111111) without altering light-surface colors.
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
  // Blend toward bright violet/white tint while preserving hue
  const mix = (c: number, target: number) =>
    Math.min(255, Math.round(c + (target - c) * 0.52))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r, 155)}${mix(g, 115)}${mix(b, 255)}`;
}

/**
 * Generates an inline SVG string for Icon #17 (from logo-icon.png) so it can also
 * be used as a dynamic theme-synced favicon or embedded inside exported HTML docs.
 */
export function buildLogo17IconSvgString(
  primaryColor = '#290076',
  accentColor = '#f4580b',
  bgFill = '#ffffff'
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="45" fill="${bgFill}" stroke="${primaryColor}" stroke-width="4" />
    <path d="M31 23 L43 17 L43 60 C43 69 49 74 58 74 C64 74 69 71 72 67 C68 75 59 80 48 80 C36 80 31 72 31 61 Z" fill="${primaryColor}" />
    <path d="M41 44 C45 36 53 31 62 32 C68 33 72 36 74 40 C70 37 66 36 61 36 C52 36 45 41 42 49 Z" fill="${primaryColor}" />
    <circle cx="59" cy="54" r="13.5" fill="${accentColor}" />
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
    xs: 22,
    sm: 30,
    md: 40,
    lg: 54,
    xl: 68,
  };
  const h = heightMap[size];

  // #17 ICON ONLY (circular b + accent dot emblem from logo-icon.png cell 17)
  if (variant === 'logo17Icon' || variant === 'logo03' || variant === 'logo09') {
    return (
      <svg
        width={h}
        height={h}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex Icon 17"
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill={onDark ? '#18181f' : '#ffffff'}
          stroke={primary}
          strokeWidth="3.6"
        />
        {/* Stylized 'b' stem & cradling lower curve matching #17 in logo-icon.png */}
        <path
          d="M31 23 L43 17 L43 60 C43 69 49 74 58 74 C64 74 69 71 72 67 C68 75 59 80 48 80 C36 80 31 72 31 61 Z"
          fill={primary}
        />
        <path
          d="M41 44 C45 36 53 31 62 32 C68 33 72 36 74 40 C70 37 66 36 61 36 C52 36 45 41 42 49 Z"
          fill={primary}
        />
        <circle cx="59" cy="54" r="13.5" fill={accent} />
      </svg>
    );
  }

  // #17 SYMBOL + WORDMARK (exact cell 17 from logo-icon.png: ring + b + accent dot + spaced serif "brandex")
  if (variant === 'logo17' || variant === 'logo06') {
    const lockupSize = h * 1.32;
    return (
      <svg
        width={lockupSize}
        height={lockupSize}
        viewBox="0 0 120 124"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex Symbol + Wordmark 17"
      >
        <circle
          cx="60"
          cy="46"
          r="39"
          fill={onDark ? '#18181f' : '#ffffff'}
          stroke={primary}
          strokeWidth="3.2"
        />
        <path
          d="M43 22 L54 17 L54 54 C54 62 59 67 67 67 C72 67 77 64 79 60 C76 68 68 72 58 72 C47 72 43 65 43 55 Z"
          fill={primary}
        />
        <path
          d="M52 40 C56 33 63 29 71 30 C76 31 79 33 81 37 C77 34 74 33 69 33 C62 33 56 38 53 45 Z"
          fill={primary}
        />
        <circle cx="68" cy="49" r="11.5" fill={accent} />
        <text
          x="60"
          y="108"
          textAnchor="middle"
          fill={onDark ? '#ffffff' : primary}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="16"
          fontWeight="500"
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
