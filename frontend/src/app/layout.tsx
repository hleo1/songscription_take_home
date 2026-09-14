import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "@/index.css";
// Self-hosted by next/font: no request to Google at runtime and no layout
// shift. Exposed as CSS variables for index.css and tailwind.config.js.
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});
export const metadata: Metadata = {
  title: "Songscription Catalogue",
  description: "Your songs, practice history, and piano settings in one place.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
