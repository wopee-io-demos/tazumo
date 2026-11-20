import { palettes, preferredPalette, type PaletteName } from './palettes.ts';
import { themes, type ColorMode, type ThemeColors } from './themes.ts';

export const brandName = 'Tazumo';

export const mascot = 'fox' as const;
export type MascotId = typeof mascot | 'none';

/** The fox keeps its own colours in every palette. */
export const foxColors = { fur: '#E8641B', shade: '#D2561A', cream: '#FFF3E3', ink: '#2A1A14' } as const;

export interface MascotDefinition {
  id: MascotId;
  label: string;
  /** Repository-relative SVG sources; null when the brand runs without a mascot. */
  assets: { mascot: string; mark: string } | null;
}

/** The mascot is decoration. Every screen must work with `none`. */
export const mascots: Record<MascotId, MascotDefinition> = {
  fox: { id: 'fox', label: 'Fox', assets: { mascot: 'assets/brand/fox-mascot.svg', mark: 'assets/brand/fox-mark.svg' } },
  none: { id: 'none', label: 'No mascot', assets: null }
};

/** Name, palette and mascot are separate decisions (ADR-0002, ADR-0011). */
export interface BrandConfig {
  name: string;
  palette: PaletteName;
  mascot: MascotId;
}

export const defaultBrandConfig: Readonly<BrandConfig> = Object.freeze({ name: brandName, palette: preferredPalette, mascot });

export interface ResolvedBrand extends BrandConfig {
  mascotDefinition: MascotDefinition;
  theme: Record<ColorMode, ThemeColors>;
}

export function createBrand(overrides: Partial<BrandConfig> = {}): ResolvedBrand {
  const config: BrandConfig = { ...defaultBrandConfig, ...overrides };
  if (!config.name.trim()) throw new Error('Brand name must not be empty');
  if (!(config.palette in palettes)) throw new Error(`Unknown palette: ${config.palette}`);
  if (!(config.mascot in mascots)) throw new Error(`Unknown mascot: ${config.mascot}`);
  return { ...config, mascotDefinition: mascots[config.mascot], theme: themes[config.palette] };
}
