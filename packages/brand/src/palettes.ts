/** Legacy palette swatches consumed by apps/web and apps/mobile. Names and values are a compatibility contract. */
export type PaletteName = 'violet' | 'coral' | 'emerald' | 'midnight';
export const palettes = {
  violet: { primary: '#6928E8', accent: '#F93C98', background: '#F5F0FF', ink: '#211239' },
  coral: { primary: '#BF3F24', accent: '#FFC857', background: '#FFF8F0', ink: '#342039' },
  emerald: { primary: '#087F62', accent: '#C9EF67', background: '#F4FAF5', ink: '#173D33' },
  midnight: { primary: '#252D37', accent: '#C4F455', background: '#F6F7F1', ink: '#161F27' }
} as const;
export const preferredPalette: PaletteName = 'violet';
export const paletteNames = Object.keys(palettes) as PaletteName[];
