import LobbyClient from "./ui";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <LobbyClient code={code.toUpperCase()} />;
}
