import type { Metadata, Viewport } from "next";
import { TabBar } from "@/components/TabBar";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "stockIO",
  description: "美股市場掃描與短線/長線建議",
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
  themeColor: "#F2F2F7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className="h-full">
      <body className="min-h-full">
        <div className="app-shell">
          <div className="app-main">
            <main>{children}</main>
          </div>
          <TabBar />
        </div>
        <PwaRegister />
      </body>
    </html>
  );
}
