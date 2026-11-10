import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Startupside — Know the startup behind the pitch", template: "%s · Startupside" },
  description:
    "Founders, funding, team growth, financial health, and competitive intelligence — a due-diligence dashboard for any startup.",
};

export const viewport: Viewport = { themeColor: "#f6f5f1" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} ${instrument.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
