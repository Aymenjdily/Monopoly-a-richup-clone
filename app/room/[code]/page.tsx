import type { Metadata } from "next";

import LobbyClient from "./ui";

/** Shared room links preview as an invite ("Join room ABC123"); no game data is exposed. */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const code = (await params).code.toUpperCase();
  const title = `Join room ${code}`;
  const description = `You're invited to a game of Dice & Deeds. Open the link to take a seat in room ${code}.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <LobbyClient code={code.toUpperCase()} />;
}
