import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Tazumo | Good things are closer", description: "Discover food, groceries and more from your city." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
