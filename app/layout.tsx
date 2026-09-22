import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppSplash } from "./app-splash";

export const metadata: Metadata = {
  title: "Coppersmith AI | İş Takip Merkezi",
  description: "Kurumsal iletişim ve stratejik projeler için ortak iş takip uygulaması.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Coppersmith AI",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17365d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body className="antialiased"><AppSplash />{children}</body></html>;
}
