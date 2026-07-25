import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Nav } from "@/components/Nav";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "stockIO",
  description: "美股市場掃描與短線/長線建議（學習用 PWA）",
  applicationName: "stockIO",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "stockIO",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F3D2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full">
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
        <PwaRegister />
      </body>
    </html>
  );
}
