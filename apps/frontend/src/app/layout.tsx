import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import { cn } from "@/lib/utils";

const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Ferrule — Pay-Per-Token AI Research Agent on Stellar",
  description:
    "Autonomous research dApp where AI agents pay each other per-token using MPP Session channels and x402 payments on Stellar.",
  keywords: [
    "Stellar",
    "AI Agent",
    "MPP",
    "x402",
    "Soroban",
    "USDC",
    "micropayments",
    "pay-per-token",
    "machine payments",
  ],
};

import { WalletProvider } from "@/context/WalletContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", GeistSans.variable, GeistMono.variable, playfair.variable)}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
