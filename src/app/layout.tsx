import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

import { site } from "@/config/site";
import "./globals.css";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s — ${site.shortName}`,
  },
  description: site.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexArabic.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
