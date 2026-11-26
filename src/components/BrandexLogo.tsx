import { useId } from 'react';

export type BrandexLogoVariant =
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
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

function getContrastText(hexColor: string): string {
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

export function BrandexLogo({
  variant = 'logo01',
  primaryColor,
  accentColor = '#f4580b',
  onDark = false,
  className = '',
  size = 'md',
}: BrandexLogoProps) {
  const uid = useId().replace(/:/g, '');
  const primary = primaryColor || (onDark ? '#ffffff' : '#290076');
  const accent = accentColor || '#f4580b';
  const rTextColor = getContrastText(accent);

  const heightMap = {
    xs: 22,
    sm: 30,
    md: 38,
    lg: 54,
  };
  const h = heightMap[size];

  if (variant === 'logo03') {
    return (
      <svg
        width={h}
        height={h}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex R Icon"
      >
        <circle cx="32" cy="32" r="28" fill={accent} />
        <text
          x="32"
          y="43"
          textAnchor="middle"
          fill={rTextColor}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="36"
          fontWeight="600"
        >
          R
        </text>
        <path
          d="M39 40 C44 47, 50 51, 56 51"
          stroke={rTextColor}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === 'logo09') {
    return (
      <svg
        width={h}
        height={h}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex App Icon"
      >
        <rect x="4" y="4" width="56" height="56" rx="14" fill={primary} />
        <circle cx="32" cy="32" r="19" fill={accent} />
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fill={rTextColor}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="24"
          fontWeight="600"
        >
          R
        </text>
      </svg>
    );
  }

  if (variant === 'logo06') {
    const topArcId = `brandex-top-${uid}`;
    const botArcId = `brandex-bot-${uid}`;
    return (
      <svg
        width={h * 1.15}
        height={h * 1.15}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex Circular Seal"
      >
        <defs>
          <path id={topArcId} d="M 22,60 A 38,38 0 1,1 98,60" />
          <path id={botArcId} d="M 18,62 A 42,42 0 0,0 102,62" />
        </defs>
        <circle cx="60" cy="60" r="56" stroke={primary} strokeWidth="2.4" fill="none" />
        <circle cx="60" cy="60" r="51" stroke={primary} strokeWidth="1.2" fill="none" />
        <circle cx="60" cy="60" r="31" stroke={primary} strokeWidth="1.2" fill="none" />
        <circle cx="60" cy="60" r="24" fill={accent} />
        <text
          x="60"
          y="69"
          textAnchor="middle"
          fill={rTextColor}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="29"
          fontWeight="600"
        >
          R
        </text>
        <circle cx="22" cy="60" r="2.2" fill={primary} />
        <circle cx="98" cy="60" r="2.2" fill={primary} />
        <text
          fill={primary}
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="9.5"
          fontWeight="700"
          letterSpacing="3"
        >
          <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
            BRANDEX
          </textPath>
        </text>
        <text
          fill={primary}
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="8.8"
          fontWeight="700"
          letterSpacing="2.4"
        >
          <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle">
            GET LEGAL
          </textPath>
        </text>
      </svg>
    );
  }

  if (variant === 'logo20') {
    return (
      <svg
        height={h}
        viewBox="0 0 230 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex Horizontal Lockup"
      >
        <circle cx="28" cy="28" r="22" fill={accent} />
        <text
          x="28"
          y="36"
          textAnchor="middle"
          fill={rTextColor}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="26"
          fontWeight="600"
        >
          R
        </text>
        <line x1="64" y1="8" x2="64" y2="48" stroke={primary} strokeWidth="1.6" />
        <text
          x="78"
          y="26"
          fill={primary}
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="15"
          fontWeight="800"
          letterSpacing="3.8"
        >
          BRANDEX
        </text>
        <text
          x="79"
          y="42"
          fill={primary}
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="9.5"
          fontWeight="700"
          letterSpacing="3"
        >
          GET LEGAL
        </text>
      </svg>
    );
  }

  if (variant === 'logo02') {
    return (
      <svg
        height={h}
        viewBox="0 0 210 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Brandex Wordmark"
      >
        <text
          x="10"
          y="44"
          fill={primary}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="44"
          fontWeight="500"
        >
          b
        </text>
        <circle cx="54" cy="31" r="16.5" fill={accent} />
        <text
          x="54"
          y="39"
          textAnchor="middle"
          fill={rTextColor}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="22"
          fontWeight="600"
        >
          R
        </text>
        <text
          x="74"
          y="44"
          fill={primary}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="44"
          fontWeight="500"
          letterSpacing="-1"
        >
          ndex
        </text>
      </svg>
    );
  }

  // Default: Logo 01 ORIGINAL REFINED (GET LEGAL above b[R]ndex)
  return (
    <svg
      height={h}
      viewBox="0 0 220 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Brandex Get Legal Logo 01"
    >
      <text
        x="110"
        y="16"
        textAnchor="middle"
        fill={primary}
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="11"
        fontWeight="700"
        letterSpacing="4.5"
      >
        GET LEGAL
      </text>
      <text
        x="14"
        y="59"
        fill={primary}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="46"
        fontWeight="500"
      >
        b
      </text>
      <circle cx="60" cy="46" r="17.5" fill={accent} />
      <text
        x="60"
        y="54"
        textAnchor="middle"
        fill={rTextColor}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="23"
        fontWeight="600"
      >
        R
      </text>
      <path
        d="M65 52 C68 57, 72 60, 76 60"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <text
        x="81"
        y="59"
        fill={primary}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="46"
        fontWeight="500"
        letterSpacing="-1"
      >
        ndex
      </text>
    </svg>
  );
}
