import { ImageResponse } from "next/og";

import { ShareCard } from "@/app/opengraph-image";

export const alt = "Invite to a Dice & Deeds game room";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Invite preview for shared room links: shows the join code only (no game data). */
export default async function RoomOpengraphImage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return new ImageResponse(<ShareCard code={code} />, size);
}
