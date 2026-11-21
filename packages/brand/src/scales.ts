/** Platform-neutral scales. Numbers are CSS pixels on web and density-independent points in React Native. */
export const spacing = { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64 } as const;

export const radius = { none: 0, sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

/** WCAG 2.2 SC 2.5.8 sets 24 as the AA minimum; 44 is the comfortable default for primary actions. */
export const touchTarget = { minimum: 24, recommended: 44 } as const;

export const fontFamily = {
  display: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  body: "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
} as const;

export const fontWeight = { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 } as const;

export interface TypeStyle {
  family: keyof typeof fontFamily;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
}

export const typography = {
  caption: { family: 'body', fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold, letterSpacing: 0.2 },
  label: { family: 'body', fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold, letterSpacing: 0 },
  body: { family: 'body', fontSize: 16, lineHeight: 24, fontWeight: fontWeight.regular, letterSpacing: 0 },
  bodyLarge: { family: 'body', fontSize: 18, lineHeight: 28, fontWeight: fontWeight.regular, letterSpacing: 0 },
  title: { family: 'display', fontSize: 22, lineHeight: 28, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  headline: { family: 'display', fontSize: 28, lineHeight: 34, fontWeight: fontWeight.extrabold, letterSpacing: -0.6 },
  display: { family: 'display', fontSize: 40, lineHeight: 46, fontWeight: fontWeight.extrabold, letterSpacing: -1.2 }
} as const satisfies Record<string, TypeStyle>;

export interface ElevationLevel {
  css: string;
  native: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

const shadow = (y: number, blur: number, opacity: number, androidElevation: number): ElevationLevel => ({
  css: y === 0 ? 'none' : `0 ${y}px ${blur}px rgba(17, 12, 28, ${opacity})`,
  native: { shadowColor: '#110C1C', shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur / 2, elevation: androidElevation }
});

/** Shadows never carry meaning alone; pair raised surfaces with a border or tint for contrast (SC 1.4.11). */
export const elevation = {
  0: shadow(0, 0, 0, 0),
  1: shadow(1, 3, 0.08, 1),
  2: shadow(4, 12, 0.08, 3),
  3: shadow(8, 24, 0.1, 6),
  4: shadow(16, 40, 0.14, 12)
} as const;

export const zIndex = { base: 0, sticky: 10, overlay: 100, dialog: 200, toast: 300 } as const;
