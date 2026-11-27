import { BRANDING_ICON_SRC_MAP, BRANDING_PLAQUE_SRC_MAP } from '../lib/branding/brandingAssets';
import { ImageColorMode } from '../types/journal';

export type BrandexButtonIconName = keyof typeof BRANDING_ICON_SRC_MAP;
export type BrandexPlaqueName = keyof typeof BRANDING_PLAQUE_SRC_MAP;

interface BrandexButtonIconProps {
  name: BrandexButtonIconName;
  variant?: 'circle' | 'square';
  size?: number;
  colorMode?: ImageColorMode;
  alt?: string;
  className?: string;
}

const DEFAULT_VARIANTS: Record<BrandexButtonIconName, 'circle' | 'square'> = {
  dashboard: 'circle',
  journalcheck: 'circle',
  review: 'circle',
  generator: 'circle',
  database: 'circle',
  records: 'circle',
  settings: 'circle',
  backup: 'circle',
  brandDark: 'circle',
  brandGold: 'circle',
  analysis: 'square',
  journalScan: 'square',
  databaseMapping: 'square',
  refresh: 'square',
  appDark: 'square',
  appYellow: 'square',
};

const CROP_SCALE: Partial<Record<BrandexButtonIconName, string>> = {
  review: 'scale-[1.48]',
  brandGold: 'scale-[1.52]',
  brandDark: 'scale-[1.54]',
  analysis: 'scale-[1.50]',
  journalScan: 'scale-[1.50]',
  databaseMapping: 'scale-[1.50]',
  refresh: 'scale-[1.50]',
  appDark: 'scale-[1.64]',
  appYellow: 'scale-[1.64]',
};

export function BrandexButtonIcon({
  name,
  variant,
  size = 20,
  colorMode,
  alt = '',
  className = '',
}: BrandexButtonIconProps) {
  const shape = variant || DEFAULT_VARIANTS[name];
  const src = BRANDING_ICON_SRC_MAP[name];
  const scaleClass = CROP_SCALE[name] || (shape === 'circle' ? 'scale-[1.56]' : 'scale-[1.52]');
  const filterClass = colorMode === 'grayscale' ? 'grayscale contrast-110' : '';

  return (
    <span
      aria-hidden={alt === ''}
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 select-none bg-[#111111] ${
        shape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
      } ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        className={`w-full h-full object-cover ${scaleClass} ${filterClass}`}
      />
    </span>
  );
}

interface BrandexPlaqueButtonProps {
  name: BrandexPlaqueName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  height?: number;
  colorMode?: ImageColorMode;
  className?: string;
}

export function BrandexPlaqueButton({
  name,
  label,
  onClick,
  disabled = false,
  height = 38,
  colorMode,
  className = '',
}: BrandexPlaqueButtonProps) {
  const src = BRANDING_PLAQUE_SRC_MAP[name];
  const width = Math.round(height * 4.15);
  const filterClass = colorMode === 'grayscale' ? 'grayscale contrast-110' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{ height, width }}
      className={`relative overflow-hidden rounded-[5px] border border-[#111111] bg-[#111111] shadow-xs disabled:opacity-45 shrink-0 ${className}`}
    >
      <img
        src={src}
        alt={label}
        draggable={false}
        className={`w-full h-full object-cover object-center scale-[1.16] ${filterClass}`}
      />
    </button>
  );
}
