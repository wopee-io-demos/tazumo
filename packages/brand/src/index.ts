export const palettePresets = {
  coral: { name: "Warm Coral", primary: "#D94D30", accent: "#FFC857", surface: "#FFF8F0", ink: "#342039" },
  violet: { name: "Electric Violet", primary: "#6928E8", accent: "#F93C98", surface: "#F5F0FF", ink: "#211239" },
  emerald: { name: "Deep Emerald", primary: "#087F62", accent: "#C9EF67", surface: "#F4FAF5", ink: "#173D33" },
  blue: { name: "Electric Blue", primary: "#2057D4", accent: "#FFBA49", surface: "#F2F6FF", ink: "#142B52" },
  midnight: { name: "Midnight Lime", primary: "#252D37", accent: "#C4F455", surface: "#F6F7F1", ink: "#161F27" },
  pink: { name: "Hot Pink", primary: "#B6206D", accent: "#FFCB46", surface: "#FFF2F8", ink: "#40152F" },
} as const;
export type PaletteId = keyof typeof palettePresets;
export const defaultPalette: PaletteId = "coral";
export const brand = {
  candidateName: "Tazumo",
  tagline: "Good things are closer.",
  description: "Food, groceries and more. From your city to your door.",
  mascot: "fox" as const,
  legalStatus: "Brand name and mark pending EU and national clearance.",
};
