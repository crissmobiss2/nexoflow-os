import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "NexoFlow OS",
    template: "%s | NexoFlow",
  },
  description: "NexoFlow build intelligence — lead-to-demo automation for software agencies",
  // app/icon.jpg and app/apple-icon.jpg auto-generate favicon link tags (Next.js App Router file convention)
  openGraph: {
    title: "NexoFlow OS",
    description: "NexoFlow build intelligence — lead-to-demo automation for software agencies",
    images: [{ url: "/nexoflow-logo.jpg", width: 1024, height: 1024 }],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased" style={{ background: "var(--surface-bg)", color: "var(--text-primary)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
