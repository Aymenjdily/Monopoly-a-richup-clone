import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PHASES, phasesList } from "@/lib/phases";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "3D Monopoly Online",
    template: "%s — 3D Monopoly Online",
  },
  description:
    "Online multiplayer Monopoly-style board game with a 3D board. Server-authoritative rules, real-time rooms.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

if (!PHASES || phasesList.length === 0) {
  throw new Error("Phase registry must not be empty");
}
