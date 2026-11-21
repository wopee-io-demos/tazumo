import type { ContrastUse } from './contrast.ts';
import type { PaletteName } from './palettes.ts';

export type ColorMode = 'light' | 'dark';
export const colorModes: readonly ColorMode[] = ['light', 'dark'];

/** Semantic colour roles. `tint` is the soft brand surface (hero, image wells, empty states). */
export interface ThemeColors {
  background: string;
  surface: string;
  tint: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  focus: string;
  border: string;
  danger: string;
  success: string;
}
export type ColorRole = keyof ThemeColors;

export const themes: Record<PaletteName, Record<ColorMode, ThemeColors>> = {
  violet: {
    light: { background: '#FFFFFF', surface: '#FFFFFF', tint: '#F5F0FF', text: '#211239', textMuted: '#5E5470', primary: '#6928E8', onPrimary: '#FFFFFF', accent: '#F93C98', onAccent: '#211239', focus: '#6928E8', border: '#857B99', danger: '#B3261E', success: '#1D7444' },
    dark: { background: '#130D1F', surface: '#1C1530', tint: '#2A2142', text: '#F4EFFF', textMuted: '#BDB3D3', primary: '#B79CFF', onPrimary: '#1A0B3D', accent: '#FF77B8', onAccent: '#2A0A1C', focus: '#B79CFF', border: '#8C82A6', danger: '#FF8A80', success: '#6FD49A' }
  },
  coral: {
    light: { background: '#FFFFFF', surface: '#FFFFFF', tint: '#FFF8F0', text: '#342039', textMuted: '#66566A', primary: '#BF3F24', onPrimary: '#FFFFFF', accent: '#FFC857', onAccent: '#342039', focus: '#BF3F24', border: '#8F7D8B', danger: '#A8231D', success: '#1D7444' },
    dark: { background: '#1B1012', surface: '#261719', tint: '#35211F', text: '#FFF3EA', textMuted: '#D2BDB5', primary: '#FF8A6B', onPrimary: '#3A0E05', accent: '#FFC857', onAccent: '#342039', focus: '#FF8A6B', border: '#9C8580', danger: '#FF9C94', success: '#6FD49A' }
  },
  emerald: {
    light: { background: '#FFFFFF', surface: '#FFFFFF', tint: '#F4FAF5', text: '#173D33', textMuted: '#4E6560', primary: '#087F62', onPrimary: '#FFFFFF', accent: '#C9EF67', onAccent: '#173D33', focus: '#087F62', border: '#7A8D87', danger: '#B3261E', success: '#1D7444' },
    dark: { background: '#0C1714', surface: '#13211D', tint: '#1C2F29', text: '#EAF7F0', textMuted: '#A9C2B9', primary: '#4FD1A5', onPrimary: '#032A1F', accent: '#C9EF67', onAccent: '#173D33', focus: '#4FD1A5', border: '#7A948B', danger: '#FF8A80', success: '#6FD49A' }
  },
  midnight: {
    light: { background: '#FFFFFF', surface: '#FFFFFF', tint: '#F6F7F1', text: '#161F27', textMuted: '#535C66', primary: '#252D37', onPrimary: '#FFFFFF', accent: '#C4F455', onAccent: '#161F27', focus: '#252D37', border: '#828990', danger: '#B3261E', success: '#1D7444' },
    dark: { background: '#0F141A', surface: '#171E26', tint: '#212A34', text: '#EEF1F4', textMuted: '#AEB7C1', primary: '#D7DEE6', onPrimary: '#161F27', accent: '#C4F455', onAccent: '#161F27', focus: '#C4F455', border: '#7D8896', danger: '#FF8A80', success: '#6FD49A' }
  }
};

export interface ContrastPairing {
  foreground: ColorRole;
  background: ColorRole;
  use: ContrastUse;
}

const textOn = (foreground: ColorRole, backgrounds: ColorRole[]): ContrastPairing[] =>
  backgrounds.map(background => ({ foreground, background, use: 'text' }));
const uiOn = (foreground: ColorRole, backgrounds: ColorRole[]): ContrastPairing[] =>
  backgrounds.map(background => ({ foreground, background, use: 'ui' }));

/** Every foreground/background combination the design system allows. Anything not listed is not an approved pairing. */
export const contrastPairings: readonly ContrastPairing[] = [
  ...textOn('text', ['background', 'surface', 'tint']),
  ...textOn('textMuted', ['background', 'surface', 'tint']),
  ...textOn('primary', ['background', 'surface', 'tint']),
  ...textOn('danger', ['background', 'surface', 'tint']),
  ...textOn('success', ['background', 'surface', 'tint']),
  ...textOn('onPrimary', ['primary']),
  ...textOn('onAccent', ['accent']),
  ...uiOn('focus', ['background', 'surface', 'tint']),
  ...uiOn('border', ['background', 'surface', 'tint'])
];

export function getTheme(palette: PaletteName, mode: ColorMode = 'light'): ThemeColors {
  return themes[palette][mode];
}

const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** CSS custom properties for a theme, e.g. `--tz-color-on-primary`. */
export function toCssVariables(colors: ThemeColors, prefix = 'tz'): Record<string, string> {
  return Object.fromEntries(Object.entries(colors).map(([role, value]) => [`--${prefix}-color-${kebab(role)}`, value]));
}
