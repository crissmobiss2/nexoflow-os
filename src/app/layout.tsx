import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NexoFlow OS",
  description: "The NexoFlow build intelligence system",
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
