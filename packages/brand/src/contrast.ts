/** WCAG 2.2 relative luminance and contrast ratio (success criteria 1.4.3, 1.4.6 and 1.4.11). */
export type ContrastUse = 'text' | 'largeText' | 'ui';

export const minimumContrast: Record<ContrastUse, number> = { text: 4.5, largeText: 3, ui: 3 };

export function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected a #RRGGBB colour, got ${hex}`);
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(channel => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(foreground: string, background: string, use: ContrastUse): boolean {
  return contrastRatio(foreground, background) >= minimumContrast[use];
}

/** WCAG large text: at least 18pt (24px) regular, or 14pt (56/3 px) bold. */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontWeight >= 700 && fontSizePx >= 56 / 3);
}
