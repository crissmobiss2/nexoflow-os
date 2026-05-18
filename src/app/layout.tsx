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
      <body className="bg-[hsl(220,20%,97%)] text-[hsl(220,20%,10%)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
