/** Independent brand decisions. Values are exploratory, not a legally approved identity. */
export { brandName, mascots, defaultBrandConfig, createBrand } from './brand.ts';
export type { BrandConfig, MascotDefinition, MascotId, ResolvedBrand } from './brand.ts';
export { palettes, preferredPalette, paletteNames } from './palettes.ts';
export type { PaletteName } from './palettes.ts';
export { themes, colorModes, contrastPairings, getTheme, toCssVariables } from './themes.ts';
export type { ColorMode, ColorRole, ContrastPairing, ThemeColors } from './themes.ts';
export { spacing, radius, touchTarget, fontFamily, fontWeight, typography, elevation, zIndex } from './scales.ts';
export type { ElevationLevel, TypeStyle } from './scales.ts';
export { contrastRatio, relativeLuminance, meetsContrast, isLargeText, minimumContrast, parseHex } from './contrast.ts';
export type { ContrastUse } from './contrast.ts';
export const mascot = 'fox';
