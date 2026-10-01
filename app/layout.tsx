import type { Metadata, Viewport } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Play a Monopoly-style board game with friends on a live 3D board. Create a room, share the 6-letter code, fill seats with bots and race to bankrupt everyone.";

// Absolute base for og:image / canonical URLs: Render sets RENDER_EXTERNAL_URL automatically.
const SITE_URL = process.env.RENDER_EXTERNAL_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dice & Deeds — multiplayer 3D board game",
    template: "%s — Dice & Deeds",
  },
  description: DESCRIPTION,
  applicationName: "Dice & Deeds",
  keywords: ["board game", "multiplayer", "monopoly", "richup", "3D", "online game", "play with friends"],
  openGraph: {
    type: "website",
    siteName: "Dice & Deeds",
    title: "Dice & Deeds — multiplayer 3D board game",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Dice & Deeds — multiplayer 3D board game",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#1b6147",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
